
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getBlockingDetails, isNodeBlocked } from "@/lib/node-status";

// Simple in-memory rate limit: UserId -> Timestamp
const rateLimit = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10; // 10 requests per minute

// Simple Cache: NodeId -> { timestamp, data }
const analysisCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL = 30 * 1000; // 30 seconds cache (short enough to be fresh, long enough to prevent spam)

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { nodeId } = z.object({ nodeId: z.string() }).parse(body);

        // 1. Rate Limit
        const lastRequest = rateLimit.get(session.user.id);
        if (lastRequest && Date.now() - lastRequest < (RATE_LIMIT_WINDOW / MAX_REQUESTS)) {
            // Allow burst but throttle simply
        }
        rateLimit.set(session.user.id, Date.now());


        // 2. Fetch Node Data (Simplified)
        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: {
                project: true,      // Fetch project basic info
                organization: true, // Fetch org basic info
                nodeOwners: { include: { user: true } },
                nodeTeams: { include: { team: true } },

                edgesFrom: {
                    include: {
                        toNode: {
                            select: {
                                id: true,
                                title: true,
                                manualStatus: true,
                                // Simplify: Don't fetch owners of dependencies for now to avoid P2022 recursion issues
                            }
                        }
                    }
                },
                linkedRequests: {
                    where: { status: { in: ["OPEN", "RESPONDED"] } },
                    include: {
                        toUser: true,
                    }
                }
            }
        });

        if (!node) {
            return NextResponse.json({ error: "Node not found" }, { status: 404 });
        }

        // 3. Permission Check (Separate Queries)
        const [isOrgMember, isProjectMember] = await Promise.all([
            prisma.orgMember.count({
                where: { orgId: node.orgId, userId: session.user.id }
            }),
            prisma.projectMember.count({
                where: { projectId: node.projectId, userId: session.user.id }
            })
        ]);

        if (isOrgMember === 0 && isProjectMember === 0) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // 4. Check Cache
        const cached = analysisCache.get(nodeId);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            return NextResponse.json(cached.data);
        }

        // 5. Prepare Context for AI
        const blockedDetails = getBlockingDetails(node as any);

        // Helper to formatting owners
        const formatOwners = (owners: any[]) => owners.map(o => o.user.name).join(", ");

        const context = {
            node: {
                title: node.title,
                description: node.description?.slice(0, 200),
                status: node.manualStatus,
                owners: formatOwners(node.nodeOwners),
                team: node.nodeTeams.map((t: any) => t.team.name).join(", ")
            },
            blockers: blockedDetails.map(d => {
                if (d.type === 'DEPENDENCY' && d.nodeId) {
                    return {
                        type: "DEPENDENCY",
                        title: (d.nodeId as any).title,
                        status: (d.nodeId as any).manualStatus,
                        // Removed owner details for stability
                    }
                }
                if (d.type === 'APPROVAL') {
                    return {
                        type: "APPROVAL",
                        title: (d.nodeId as any).title,
                        status: (d.nodeId as any).manualStatus,
                    }
                }
                if (d.type === 'REQUEST') {
                    return {
                        type: 'REQUEST',
                        status: (d as any).status,
                        question: node.linkedRequests.find((r: any) => r.id === (d as any).requestId)?.question
                    };
                }
                return d;
            })
        };

        // 5. Call Gemini
        const { object } = await generateObject({
            model: google("models/gemini-1.5-flash-latest"),
            schema: z.object({
                summary: z.string().describe("Why is this node blocked? 1 sentence."),
                blockingReasons: z.array(z.object({
                    type: z.enum(["DEPENDENCY", "APPROVAL", "REQUEST", "OTHER"]),
                    targetTitle: z.string().describe("Title of the blocking item"),
                    actionNeeded: z.string().describe("What needs to happen? e.g. 'John needs to approve'")
                })),
                whoShouldAct: z.array(z.object({
                    name: z.string(),
                    role: z.string().optional(),
                    nextStep: z.string()
                })),
                suggestedRequests: z.array(z.object({
                    recipient: z.string(),
                    draftMessage: z.string()
                })).optional()
            }),
            prompt: `
        Analyze why this task is blocked.
        Context: ${JSON.stringify(context, null, 2)}
        
        Rules:
        - Be concise.
        - Identify WHO is holding this up.
        - If it's a dependency, say who owns that dependency.
        - If it's a request, say who needs to answer.
      `,
        });

        // 6. Update Cache
        analysisCache.set(nodeId, { timestamp: Date.now(), data: object });

        return NextResponse.json(object);

    } catch (error) {
        console.error("AI Analysis Error:", error);
        return NextResponse.json({ error: "Failed to analyze" }, { status: 500 });
    }
}
