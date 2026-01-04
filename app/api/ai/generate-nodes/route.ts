import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectView } from "@/lib/utils/permissions";
import { isOrgPro } from "@/lib/subscription";
import { getOpenAIClient, checkRateLimit, NodeGenerationResult } from "@/lib/ai/openai";
import { z } from "zod";

const GenerateNodesSchema = z.object({
    projectId: z.string(),
    text: z.string().min(1).max(5000),
});

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await req.json();
        const { projectId, text } = GenerateNodesSchema.parse(body);

        // Get project to verify access and get orgId
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, orgId: true, name: true },
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

        // Call OpenAI (ChatGPT)
        const openai = getOpenAIClient();
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a project management assistant. Extract tasks from user input and create a structured node list.
Always respond with valid JSON in this format:
{
  "nodes": [
    {"title": "Task title", "description": "Brief description", "type": "TASK|DECISION|BLOCKER|INFOREQ"}
  ],
  "edges": [
    {"fromIndex": 0, "toIndex": 1, "relation": "DEPENDS_ON|APPROVAL_BY"}
  ]
}
Keep task titles concise (max 50 chars). Description optional but helpful.
Only create edges when there's a clear dependency or approval relationship.
Types: TASK (most common), DECISION (requires choice), BLOCKER (blocking issue), INFOREQ (needs information).`,
                },
                {
                    role: "user",
                    content: `Extract tasks from this text:\n\n${text}`,
                },
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_tokens: 2000,
        });

        const responseText = completion.choices[0]?.message?.content || "{}";
        let result: NodeGenerationResult;

        try {
            result = JSON.parse(responseText);
            // Validate structure
            if (!Array.isArray(result.nodes)) {
                result = { nodes: [], edges: [] };
            }
            if (!Array.isArray(result.edges)) {
                result.edges = [];
            }
        } catch {
            result = { nodes: [], edges: [] };
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("Node Generation Error:", error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        return NextResponse.json({ error: "Failed to generate nodes" }, { status: 500 });
    }
}
