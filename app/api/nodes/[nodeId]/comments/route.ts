import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectEdit, requireProjectView } from "@/lib/utils/permissions";
import { authOrPermissionErrorResponse } from "@/lib/utils/api-error-responses";
import { createActivityLog } from "@/lib/utils/activity-log";
import { createNotification } from "@/lib/utils/notifications";
import {
    extractMentionNames,
    getNodeForCollaboration,
    resolveMentionedProjectUsers,
    toNodeCommentDTO,
} from "@/lib/utils/node-collaboration";
import { z } from "zod";

const CreateCommentSchema = z.object({
    body: z.string().min(1).max(20_000),
});

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ nodeId: string }> }
) {
    try {
        const user = await requireAuth();
        const { nodeId } = await params;
        const node = await getNodeForCollaboration(nodeId);

        if (!node) {
            return NextResponse.json({ error: "Node not found" }, { status: 404 });
        }

        await requireProjectView(node.projectId, user.id);

        const comments = await prisma.nodeComment.findMany({
            where: { nodeId },
            include: {
                author: { select: { name: true, email: true, image: true } },
            },
            orderBy: { createdAt: "asc" },
        });

        return NextResponse.json({ comments: comments.map(toNodeCommentDTO) });
    } catch (error) {
        const authResponse = authOrPermissionErrorResponse(error);
        if (authResponse) return authResponse;
        console.error("GET /api/nodes/[nodeId]/comments error:", error);
        return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ nodeId: string }> }
) {
    try {
        const user = await requireAuth();
        const { nodeId } = await params;
        const body = await request.json();
        const validated = CreateCommentSchema.parse(body);
        const node = await getNodeForCollaboration(nodeId);

        if (!node) {
            return NextResponse.json({ error: "Node not found" }, { status: 404 });
        }

        await requireProjectEdit(node.projectId, user.id);

        const comment = await prisma.nodeComment.create({
            data: {
                nodeId,
                orgId: node.orgId,
                projectId: node.projectId,
                authorId: user.id,
                body: validated.body,
            },
            include: {
                author: { select: { name: true, email: true, image: true } },
            },
        });

        await createActivityLog({
            orgId: node.orgId,
            projectId: node.projectId,
            userId: user.id,
            action: "CREATE_NODE_COMMENT",
            entityType: "NODE_COMMENT",
            entityId: comment.id,
            details: { nodeId },
        });

        const mentionedUsers = await resolveMentionedProjectUsers(node.projectId, extractMentionNames(validated.body));
        for (const mentionedUser of mentionedUsers) {
            if (mentionedUser.id === user.id) continue;
            await createNotification({
                userId: mentionedUser.id,
                orgId: node.orgId,
                type: "MENTION",
                title: "Mentioned in a task",
                message: `${user.name || user.email} mentioned you on "${node.title}".`,
                entityId: nodeId,
                dedupeKey: `MENTION:${comment.id}:${mentionedUser.id}`,
            });
        }

        return NextResponse.json({ comment: toNodeCommentDTO(comment) }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
        }

        const authResponse = authOrPermissionErrorResponse(error);
        if (authResponse) return authResponse;

        console.error("POST /api/nodes/[nodeId]/comments error:", error);
        return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
    }
}
