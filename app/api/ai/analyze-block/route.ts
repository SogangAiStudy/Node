import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectView } from "@/lib/utils/permissions";
import { isOrgPro } from "@/lib/subscription";
import {
    getOpenAIClient,
    checkRateLimit,
    getCachedBlockAnalysis,
    setCachedBlockAnalysis,
    BlockAnalysisResult,
} from "@/lib/ai/openai";
import { z } from "zod";
import { getBlockingDetails } from "@/lib/node-status";

const AnalyzeBlockSchema = z.object({
    nodeId: z.string(),
});

// Simple in-memory cache for quick lookups
const analysisCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL = 60 * 1000; // 1 minute

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await req.json();
        const { nodeId } = AnalyzeBlockSchema.parse(body);

        // Fetch Node Data
        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: {
                project: { select: { id: true, name: true, orgId: true } },
                nodeOwners: { include: { user: { select: { id: true, name: true } } } },
                nodeTeams: { include: { team: { select: { id: true, name: true } } } },
                edgesFrom: {
                    include: {
                        toNode: {
                            select: {
                                id: true,
                                title: true,
                                manualStatus: true,
                                nodeOwners: { include: { user: { select: { id: true, name: true } } } },
                            },
                        },
                    },
                },
                linkedRequests: {
                    where: { status: { in: ["OPEN", "RESPONDED"] } },
                    include: { toUser: { select: { id: true, name: true } } },
                },
            },
        });

        if (!node) {
            return NextResponse.json({ error: "Node not found" }, { status: 404 });
        }

        // Permission Check
        await requireProjectView(node.projectId, user.id);

        // Pro Subscription Check
        const isPro = await isOrgPro(node.project.orgId);
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

        // Check Cache
        const cached = getCachedBlockAnalysis(nodeId, node.updatedAt.toISOString());
        if (cached) {
            return NextResponse.json(cached);
        }

        // Build context for AI
        const blockedDetails = getBlockingDetails(node as any);

        const formatOwners = (owners: any[]) =>
            owners.map((o) => ({ id: o.user.id, name: o.user.name }));

        const context = {
            node: {
                title: node.title,
                description: node.description?.slice(0, 200),
                status: node.manualStatus,
                owners: formatOwners(node.nodeOwners),
                teams: node.nodeTeams.map((t) => ({ id: t.team.id, name: t.team.name })),
            },
            blockers: blockedDetails.map((d: any) => {
                if (d.type === "DEPENDENCY" && d.nodeId) {
                    return {
                        type: "DEPENDENCY",
                        title: d.nodeId.title || "Unknown",
                        status: d.nodeId.manualStatus || "TODO",
                    };
                }
                if (d.type === "APPROVAL") {
                    return {
                        type: "APPROVAL",
                        title: d.nodeId?.title || "Unknown",
                    };
                }
                if (d.type === "REQUEST") {
                    const req = node.linkedRequests.find((r: any) => r.id === d.requestId);
                    return {
                        type: "REQUEST",
                        question: req?.question?.slice(0, 100),
                        toUser: req?.toUser ? { id: req.toUser.id, name: req.toUser.name } : null,
                    };
                }
                return d;
            }),
        };

        // Call OpenAI (ChatGPT)
        const openai = getOpenAIClient();
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a project management assistant. Analyze why a task is blocked and provide actionable guidance.
Always respond with valid JSON in this format:
{
  "summary": "Brief 1-sentence explanation of why blocked",
  "blockingReasons": [{"type": "DEPENDENCY|APPROVAL|REQUEST|OTHER", "targetTitle": "...", "actionNeeded": "..."}],
  "whoShouldAct": [{"name": "...", "role": "...", "nextStep": "..."}],
  "suggestedRequests": [{"recipient": "...", "draftMessage": "..."}]
}`,
                },
                {
                    role: "user",
                    content: `Analyze why this task is blocked:\n${JSON.stringify(context, null, 2)}`,
                },
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_tokens: 600,
        });

        const responseText = completion.choices[0]?.message?.content || "{}";
        let result;

        try {
            result = JSON.parse(responseText);
        } catch {
            result = {
                summary: "Unable to analyze - please try again",
                blockingReasons: [],
                whoShouldAct: [],
                suggestedRequests: [],
            };
        }

        // Cache result
        setCachedBlockAnalysis(nodeId, node.updatedAt.toISOString(), result);

        return NextResponse.json(result);
    } catch (error) {
        console.error("AI Analysis Error:", error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        return NextResponse.json({ error: "Failed to analyze" }, { status: 500 });
    }
}
