import { prisma } from "@/lib/db/prisma";
import { ActivityLogEntry, NodeAttachmentDTO, NodeCommentDTO, NodePageDTO } from "@/types";
import type { ActivityLog, NodeAttachment, NodeComment, NodePage, User } from "@prisma/client";

type CommentWithAuthor = NodeComment & { author: Pick<User, "name" | "email" | "image"> };
type AttachmentWithUploader = NodeAttachment & { uploader?: Pick<User, "name"> | null };
type ActivityWithUser = ActivityLog & { user?: Pick<User, "name"> | null };

export const NODE_ATTACHMENT_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "node-attachments";
export const MAX_NODE_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
]);

export function assertAllowedAttachment(file: File) {
    if (file.size > MAX_NODE_ATTACHMENT_BYTES) {
        throw new Error("Attachment is larger than the 25MB limit");
    }

    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type)) {
        throw new Error("File type is not allowed");
    }
}

export function toNodePageDTO(page: NodePage): NodePageDTO {
    return {
        id: page.id,
        nodeId: page.nodeId,
        orgId: page.orgId,
        projectId: page.projectId,
        contentMarkdown: page.contentMarkdown,
        updatedByUserId: page.updatedByUserId,
        createdAt: page.createdAt.toISOString(),
        updatedAt: page.updatedAt.toISOString(),
    };
}

export function toNodeCommentDTO(comment: CommentWithAuthor): NodeCommentDTO {
    return {
        id: comment.id,
        nodeId: comment.nodeId,
        orgId: comment.orgId,
        projectId: comment.projectId,
        authorId: comment.authorId,
        authorName: comment.author?.name ?? null,
        authorEmail: comment.author?.email ?? "",
        authorImage: comment.author?.image ?? null,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
    };
}

export async function toNodeAttachmentDTO(attachment: AttachmentWithUploader): Promise<NodeAttachmentDTO> {
    return {
        id: attachment.id,
        nodeId: attachment.nodeId,
        orgId: attachment.orgId,
        projectId: attachment.projectId,
        uploadedBy: attachment.uploadedBy,
        uploadedByName: attachment.uploader?.name ?? null,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        storageKey: attachment.storageKey,
        downloadUrl: await createAttachmentDownloadUrl(attachment.storageKey),
        createdAt: attachment.createdAt.toISOString(),
    };
}

export function toActivityLogEntry(log: ActivityWithUser): ActivityLogEntry {
    return {
        id: log.id,
        orgId: log.orgId,
        projectId: log.projectId,
        userId: log.userId,
        userName: log.user?.name || "Unknown User",
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        details: log.details as Record<string, unknown> | null,
        createdAt: log.createdAt.toISOString(),
    };
}

export async function getNodeForCollaboration(nodeId: string) {
    return prisma.node.findUnique({
        where: { id: nodeId },
        select: {
            id: true,
            orgId: true,
            projectId: true,
            title: true,
            description: true,
        },
    });
}

export function extractMentionNames(text: string) {
    return Array.from(new Set(Array.from(text.matchAll(/@([\p{L}\p{N}._ -]{2,80})/gu)).map((match) => match[1].trim())));
}

export async function resolveMentionedProjectUsers(projectId: string, mentionNames: string[]) {
    if (mentionNames.length === 0) return [];

    const lowerNames = mentionNames.map((name) => name.toLowerCase());
    const members = await prisma.projectMember.findMany({
        where: { projectId },
        include: {
            user: { select: { id: true, name: true, email: true } },
        },
    });

    return members
        .map((member) => member.user)
        .filter((user) => {
            const candidates = [user.name, user.email].filter(Boolean).map((value) => value!.toLowerCase());
            return candidates.some((candidate) => lowerNames.some((mention) => candidate.includes(mention)));
        });
}

function getSupabaseStorageConfig() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        return null;
    }

    return {
        baseUrl: url.replace(/\/$/, ""),
        key,
    };
}

export async function uploadNodeAttachment(storageKey: string, file: File) {
    const config = getSupabaseStorageConfig();
    if (!config) {
        throw new Error("Supabase storage is not configured");
    }

    const response = await fetch(`${config.baseUrl}/storage/v1/object/${NODE_ATTACHMENT_BUCKET}/${storageKey}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${config.key}`,
            apikey: config.key,
            "Content-Type": file.type,
            "x-upsert": "false",
        },
        body: await file.arrayBuffer(),
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to upload attachment");
    }
}

export async function deleteNodeAttachmentObject(storageKey: string) {
    const config = getSupabaseStorageConfig();
    if (!config) return;

    await fetch(`${config.baseUrl}/storage/v1/object/${NODE_ATTACHMENT_BUCKET}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${config.key}`,
            apikey: config.key,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefixes: [storageKey] }),
    });
}

export async function createAttachmentDownloadUrl(storageKey: string) {
    const config = getSupabaseStorageConfig();
    if (!config) return null;

    const response = await fetch(`${config.baseUrl}/storage/v1/object/sign/${NODE_ATTACHMENT_BUCKET}/${storageKey}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${config.key}`,
            apikey: config.key,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: 60 * 60 }),
        cache: "no-store",
    });

    if (!response.ok) {
        return null;
    }

    const data = await response.json();
    return data.signedURL ? `${config.baseUrl}/storage/v1${data.signedURL}` : null;
}
