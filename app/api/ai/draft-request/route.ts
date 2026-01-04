import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectView } from "@/lib/utils/permissions";
import { isOrgPro } from "@/lib/subscription";
import { getOpenAIClient, checkRateLimit } from "@/lib/ai/openai";
import { z } from "zod";
import { getBlockingDetails } from "@/lib/node-status";

const DraftRequestSchema = z.object({
    nodeId: z.string(),
    recipientId: z.string().optional(),
    recipientName: z.string().optional(),
    context: z.string().optional(),
});

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await req.json();
        const { nodeId, recipientId, recipientName, context: userContext } = DraftRequestSchema.parse(body);

        // Fetch Node Data
        const node = await prisma.node.findUnique({
            where: { id: nodeId },
            include: {
                project: { select: { id: true, name: true, orgId: true } },
                nodeOwners: { include: { user: { select: { id: true, name: true } } } },
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

        // Build context
        const blockedDetails = getBlockingDetails(node as any);
        const blockingReasons = blockedDetails
            .map((d: any) => {
                if (d.type === "DEPENDENCY") return `Waiting on: "${d.nodeId?.title || "a task"}"`;
                if (d.type === "APPROVAL") return `Needs approval for: "${d.nodeId?.title || "a task"}"`;
                if (d.type === "REQUEST") return "Has an open request pending";
                return "Unknown blocker";
            })
            .join("; ");

        // Determine recipient
        let recipient = recipientName || "the team";
        if (recipientId && !recipientName) {
            const foundUser = await prisma.user.findUnique({
                where: { id: recipientId },
                select: { name: true },
            });
            if (foundUser?.name) recipient = foundUser.name;
        }

        // Call OpenAI (ChatGPT)
        const openai = getOpenAIClient();
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a helpful project assistant. Draft a polite, professional, and concise request message.
Keep it under 200 characters if possible. Don't use hashtags. Be friendly but direct.`,
                },
                {
                    role: "user",
                    content: `Draft a request to ${recipient} regarding the task "${node.title}".
${blockingReasons ? `This task is blocked because: ${blockingReasons}` : "We need to move this forward."}
${userContext ? `Additional context: "${userContext}"` : ""}
Goal: Get them to help unblock this task.`,
                },
            ],
            temperature: 0.8,
            max_tokens: 200,
        });

        const draft = completion.choices[0]?.message?.content || "Hi, could you please help with this task?";

        return NextResponse.json({ draft });
    } catch (error) {
        console.error("Drafting Error:", error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        return NextResponse.json({ error: "Failed to draft" }, { status: 500 });
    }
}
