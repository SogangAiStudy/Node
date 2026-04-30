import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { isProjectAdmin, requireProjectView } from "@/lib/utils/permissions";
import { authOrPermissionErrorResponse } from "@/lib/utils/api-error-responses";
import { createActivityLog } from "@/lib/utils/activity-log";
import { getNodeForCollaboration, toNodeCommentDTO } from "@/lib/utils/node-collaboration";
import { z } from "zod";

const UpdateCommentSchema = z.object({
    body: z.string().min(1).max(20_000),
});

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ nodeId: string; commentId: string }> }
) {
    try {
        const user = await requireAuth();
        const { nodeId, commentId } = await params;
        const body = await request.json();
        const validated = UpdateCommentSchema.parse(body);
        const node = await getNodeForCollaboration(nodeId);

        if (!node) {
            return NextResponse.json({ error: "Node not found" }, { status: 404 });
        }

        await requireProjectView(node.projectId, user.id);

        const existing = await prisma.nodeComment.findUnique({ where: { id: commentId } });
        if (!existing || existing.nodeId !== nodeId) {
            return NextResponse.json({ error: "Comment not found" }, { status: 404 });
        }

        const canManage = existing.authorId === user.id || await isProjectAdmin(node.projectId, user.id);
        if (!canManage) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const comment = await prisma.nodeComment.update({
            where: { id: commentId },
            data: { body: validated.body },
            include: { author: { select: { name: true, email: true, image: true } } },
        });

        await createActivityLog({
            orgId: node.orgId,
            projectId: node.projectId,
            userId: user.id,
            action: "UPDATE_NODE_COMMENT",
            entityType: "NODE_COMMENT",
            entityId: comment.id,
            details: { nodeId },
        });

        return NextResponse.json({ comment: toNodeCommentDTO(comment) });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
        }

        const authResponse = authOrPermissionErrorResponse(error);
        if (authResponse) return authResponse;

        console.error("PATCH /api/nodes/[nodeId]/comments/[commentId] error:", error);
        return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ nodeId: string; commentId: string }> }
) {
    try {
        const user = await requireAuth();
        const { nodeId, commentId } = await params;
        const node = await getNodeForCollaboration(nodeId);

        if (!node) {
            return NextResponse.json({ error: "Node not found" }, { status: 404 });
        }

        await requireProjectView(node.projectId, user.id);

        const existing = await prisma.nodeComment.findUnique({ where: { id: commentId } });
        if (!existing || existing.nodeId !== nodeId) {
            return NextResponse.json({ error: "Comment not found" }, { status: 404 });
        }

        const canManage = existing.authorId === user.id || await isProjectAdmin(node.projectId, user.id);
        if (!canManage) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.nodeComment.delete({ where: { id: commentId } });
        await createActivityLog({
            orgId: node.orgId,
            projectId: node.projectId,
            userId: user.id,
            action: "DELETE_NODE_COMMENT",
            entityType: "NODE_COMMENT",
            entityId: commentId,
            details: { nodeId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        const authResponse = authOrPermissionErrorResponse(error);
        if (authResponse) return authResponse;
        console.error("DELETE /api/nodes/[nodeId]/comments/[commentId] error:", error);
        return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
    }
}
