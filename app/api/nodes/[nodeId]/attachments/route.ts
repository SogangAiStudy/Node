import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectEdit, requireProjectView } from "@/lib/utils/permissions";
import { authOrPermissionErrorResponse } from "@/lib/utils/api-error-responses";
import { createActivityLog } from "@/lib/utils/activity-log";
import {
    assertAllowedAttachment,
    getNodeForCollaboration,
    toNodeAttachmentDTO,
    uploadNodeAttachment,
} from "@/lib/utils/node-collaboration";

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

        const attachments = await prisma.nodeAttachment.findMany({
            where: { nodeId },
            include: {
                uploader: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ attachments: await Promise.all(attachments.map(toNodeAttachmentDTO)) });
    } catch (error) {
        const authResponse = authOrPermissionErrorResponse(error);
        if (authResponse) return authResponse;
        console.error("GET /api/nodes/[nodeId]/attachments error:", error);
        return NextResponse.json({ error: "Failed to fetch attachments" }, { status: 500 });
    }
}

export async function POST(
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

        await requireProjectEdit(node.projectId, user.id);

        const formData = await request.formData();
        const file = formData.get("file");
        if (!(file instanceof File)) {
            return NextResponse.json({ error: "file is required" }, { status: 400 });
        }

        assertAllowedAttachment(file);

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);
        const storageKey = `${node.orgId}/${node.projectId}/${nodeId}/${crypto.randomUUID()}-${safeName}`;

        await uploadNodeAttachment(storageKey, file);

        const attachment = await prisma.nodeAttachment.create({
            data: {
                nodeId,
                orgId: node.orgId,
                projectId: node.projectId,
                uploadedBy: user.id,
                fileName: file.name,
                mimeType: file.type,
                sizeBytes: file.size,
                storageKey,
            },
            include: {
                uploader: { select: { name: true } },
            },
        });

        await createActivityLog({
            orgId: node.orgId,
            projectId: node.projectId,
            userId: user.id,
            action: "CREATE_NODE_ATTACHMENT",
            entityType: "NODE_ATTACHMENT",
            entityId: attachment.id,
            details: { nodeId, fileName: file.name, sizeBytes: file.size },
        });

        return NextResponse.json({ attachment: await toNodeAttachmentDTO(attachment) }, { status: 201 });
    } catch (error) {
        if (error instanceof Error && (error.message.includes("25MB") || error.message.includes("File type") || error.message.includes("storage"))) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        const authResponse = authOrPermissionErrorResponse(error);
        if (authResponse) return authResponse;

        console.error("POST /api/nodes/[nodeId]/attachments error:", error);
        return NextResponse.json({ error: "Failed to upload attachment" }, { status: 500 });
    }
}
