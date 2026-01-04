import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectView } from "@/lib/utils/permissions";
import { isOrgPro } from "@/lib/subscription";
import { getOpenAIClient, checkRateLimit, OrganizeResult } from "@/lib/ai/openai";
import { z } from "zod";

const OrganizeSchema = z.object({
    projectId: z.string(),
});

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await req.json();
        const { projectId } = OrganizeSchema.parse(body);

        // Get project with nodes
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                nodes: {
                    select: {
                        id: true,
                        title: true,
                        type: true,
                        manualStatus: true,
                        nodeOwners: { include: { user: { select: { name: true } } } },
                        nodeTeams: { include: { team: { select: { name: true } } } },
                    },
                },
                edges: {
                    select: {
                        fromNodeId: true,
                        toNodeId: true,
                        relation: true,
                    },
                },
            },
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Permission Check
        await requireProjectView(projectId, user.id);

        // Pro Subscription Check
        const isPro = await isOrgPro(project.orgId);
        if (!isPro) {
            return NextResponse.json(
                { error: "AI features require a Pro subscription" },
                { status: 403 }
            );
        }

        // Rate Limit Check
        if (!checkRateLimit(user.id)) {
            return NextResponse.json(
                { error: "Rate limit exceeded. Please try again in a minute." },
                { status: 429 }
            );
        }

        if (project.nodes.length === 0) {
            return NextResponse.json({
                clusters: [],
                layoutSuggestion: "horizontal",
            });
        }

        // Build graph summary for AI
        const nodeSummary = project.nodes.map((n) => ({
            id: n.id,
            title: n.title,
            type: n.type,
            status: n.manualStatus,
            owners: n.nodeOwners.map((o) => o.user.name).join(", "),
            teams: n.nodeTeams.map((t) => t.team.name).join(", "),
        }));

        const edgeSummary = project.edges.map((e) => ({
            from: project.nodes.find((n) => n.id === e.fromNodeId)?.title || "Unknown",
            to: project.nodes.find((n) => n.id === e.toNodeId)?.title || "Unknown",
            relation: e.relation,
        }));

        // Call OpenAI (ChatGPT)
        const openai = getOpenAIClient();
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a project management assistant. Analyze a project graph and suggest logical clusters/groupings.
Always respond with valid JSON in this format:
{
  "clusters": [
    {"name": "Cluster name", "nodeIds": ["id1", "id2"], "reason": "Why these belong together"}
  ],
  "layoutSuggestion": "horizontal|vertical|radial|hierarchical"
}
Group by: team ownership, feature area, phase/stage, or dependency chains.
Layout suggestions: horizontal (wide projects), vertical (sequential), radial (hub-spoke), hierarchical (layered dependencies).`,
                },
                {
                    role: "user",
                    content: `Analyze this project graph and suggest clusters:

Nodes: ${JSON.stringify(nodeSummary)}

Edges: ${JSON.stringify(edgeSummary)}`,
                },
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_tokens: 1500,
        });

        const responseText = completion.choices[0]?.message?.content || "{}";
        let result: OrganizeResult;

        try {
            result = JSON.parse(responseText);
            // Validate structure
            if (!Array.isArray(result.clusters)) {
                result = { clusters: [], layoutSuggestion: "horizontal" };
            }
        } catch {
            result = { clusters: [], layoutSuggestion: "horizontal" };
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("Organize Error:", error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        return NextResponse.json({ error: "Failed to organize" }, { status: 500 });
    }
}
