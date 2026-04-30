import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { isProjectAdmin, requireProjectView } from "@/lib/utils/permissions";
import { authOrPermissionErrorResponse } from "@/lib/utils/api-error-responses";
import { createActivityLog } from "@/lib/utils/activity-log";
import { deleteNodeAttachmentObject, getNodeForCollaboration } from "@/lib/utils/node-collaboration";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ nodeId: string; attachmentId: string }> }
) {
    try {
        const user = await requireAuth();
        const { nodeId, attachmentId } = await params;
        const node = await getNodeForCollaboration(nodeId);

        if (!node) {
            return NextResponse.json({ error: "Node not found" }, { status: 404 });
        }

        await requireProjectView(node.projectId, user.id);

        const attachment = await prisma.nodeAttachment.findUnique({ where: { id: attachmentId } });
        if (!attachment || attachment.nodeId !== nodeId) {
            return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
        }

        const canManage = attachment.uploadedBy === user.id || await isProjectAdmin(node.projectId, user.id);
        if (!canManage) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.nodeAttachment.delete({ where: { id: attachmentId } });
        await deleteNodeAttachmentObject(attachment.storageKey);

        await createActivityLog({
            orgId: node.orgId,
            projectId: node.projectId,
            userId: user.id,
            action: "DELETE_NODE_ATTACHMENT",
            entityType: "NODE_ATTACHMENT",
            entityId: attachmentId,
            details: { nodeId, fileName: attachment.fileName },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        const authResponse = authOrPermissionErrorResponse(error);
        if (authResponse) return authResponse;
        console.error("DELETE /api/nodes/[nodeId]/attachments/[attachmentId] error:", error);
        return NextResponse.json({ error: "Failed to delete attachment" }, { status: 500 });
    }
}
