
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getBlockingDetails } from "@/lib/node-status";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { nodeId, recipientId, context: userProvidedContext } = z.object({
            nodeId: z.string(),
            recipientId: z.string().optional(),
            context: z.string().optional()
        }).parse(body);

        // 1. Fetch Node Data
        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: {
                project: true,
                organization: true,
                nodeOwners: {
                    include: {
                        user: true
                    }
                },
                edgesFrom: { include: { toNode: { include: { nodeOwners: { include: { user: true } } } } } }
            }
        });

        if (!node) {
            return NextResponse.json({ error: "Node not found" }, { status: 404 });
        }

        // Auth Check (Separate)
        const [isOrgMember, isProjectMember] = await Promise.all([
            prisma.orgMember.count({ where: { orgId: node.orgId, userId: session.user.id } }),
            prisma.projectMember.count({ where: { projectId: node.projectId, userId: session.user.id } })
        ]);

        if (isOrgMember === 0 && isProjectMember === 0) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // 2. Prepare Context
        // Who are we writing to?
        let recipientName = "the responsible party";
        if (recipientId) {
            // Try to find recipient name from node context (owners of dependencies, etc.)
            // For simplicity, we trust the ID or look it up if we had a user cache.
            // Let's just say "Colleague" if unknown, or try to find in edges.
            const found = node.edgesFrom.flatMap(e => e.toNode.nodeOwners).find((o: any) => o.userId === recipientId);
            if (found) recipientName = found.user.name || "Colleague";
        }

        const blockedDetails = getBlockingDetails(node as any);
        const blockingReasons = blockedDetails.map(d => {
            if (d.type === 'DEPENDENCY') return `Waiting on dependency: "${(d as any).nodeId.title}"`;
            if (d.type === 'APPROVAL') return `Waiting for approval on: "${(d as any).nodeId.title}"`;
            return "Unknown blocker";
        }).join(", ");

        // 3. Stream Text
        const result = streamText({
            model: google("models/gemini-1.5-flash-latest"),
            system: `You are a helpful project assistant. Draft a polite, professional, and concise Slack-style message or email. 
        Don't use hashtags. Keep it under 300 characters if possible.`,
            prompt: `
        Draft a request to ${recipientName} regarding the task "${node.title}".
        My task is blocked because: ${blockingReasons || "we need to move forward"}.
        ${userProvidedContext ? `Additional context from me: "${userProvidedContext}"` : ""}
        
        Goal: Unblock this task using a polite request.
        `
        });

        return result.toTextStreamResponse();

    } catch (error) {
        console.error("Drafting Error:", error);
        return NextResponse.json({ error: "Failed to draft" }, { status: 500 });
    }
}
