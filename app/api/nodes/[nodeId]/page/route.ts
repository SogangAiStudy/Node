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
    toActivityLogEntry,
    toNodePageDTO,
} from "@/lib/utils/node-collaboration";
import { z } from "zod";

const UpdateNodePageSchema = z.object({
    contentMarkdown: z.string().max(200_000),
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

        const [page, activity] = await Promise.all([
            prisma.nodePage.upsert({
                where: { nodeId },
                create: {
                    nodeId,
                    orgId: node.orgId,
                    projectId: node.projectId,
                    contentMarkdown: node.description || "",
                },
                update: {},
            }),
            prisma.activityLog.findMany({
                where: {
                    projectId: node.projectId,
                    OR: [
                        { entityType: "NODE", entityId: nodeId },
                        { entityType: "NODE_COMMENT", details: { path: ["nodeId"], equals: nodeId } },
                        { entityType: "NODE_ATTACHMENT", details: { path: ["nodeId"], equals: nodeId } },
                    ],
                },
                include: { user: { select: { name: true } } },
                orderBy: { createdAt: "desc" },
                take: 20,
            }),
        ]);

        return NextResponse.json({
            page: toNodePageDTO(page),
            activity: activity.map(toActivityLogEntry),
        });
    } catch (error) {
        const authResponse = authOrPermissionErrorResponse(error);
        if (authResponse) return authResponse;
        console.error("GET /api/nodes/[nodeId]/page error:", error);
        return NextResponse.json({ error: "Failed to fetch task page" }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ nodeId: string }> }
) {
    try {
        const user = await requireAuth();
        const { nodeId } = await params;
        const body = await request.json();
        const validated = UpdateNodePageSchema.parse(body);
        const node = await getNodeForCollaboration(nodeId);

        if (!node) {
            return NextResponse.json({ error: "Node not found" }, { status: 404 });
        }

        await requireProjectEdit(node.projectId, user.id);

        const page = await prisma.nodePage.upsert({
            where: { nodeId },
            create: {
                nodeId,
                orgId: node.orgId,
                projectId: node.projectId,
                contentMarkdown: validated.contentMarkdown,
                updatedByUserId: user.id,
            },
            update: {
                contentMarkdown: validated.contentMarkdown,
                updatedByUserId: user.id,
            },
        });

        await createActivityLog({
            orgId: node.orgId,
            projectId: node.projectId,
            userId: user.id,
            action: "UPDATE_NODE_PAGE",
            entityType: "NODE",
            entityId: nodeId,
            details: { nodeId },
        });

        const mentionedUsers = await resolveMentionedProjectUsers(
            node.projectId,
            extractMentionNames(validated.contentMarkdown)
        );
        for (const mentionedUser of mentionedUsers) {
            if (mentionedUser.id === user.id) continue;
            await createNotification({
                userId: mentionedUser.id,
                orgId: node.orgId,
                type: "MENTION",
                title: "Mentioned in a task page",
                message: `${user.name || user.email} mentioned you on "${node.title}".`,
                entityId: nodeId,
                dedupeKey: `MENTION_PAGE:${page.id}:${page.updatedAt.getTime()}:${mentionedUser.id}`,
            });
        }

        return NextResponse.json({ page: toNodePageDTO(page) });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
        }

        const authResponse = authOrPermissionErrorResponse(error);
        if (authResponse) return authResponse;

        console.error("PATCH /api/nodes/[nodeId]/page error:", error);
        return NextResponse.json({ error: "Failed to update task page" }, { status: 500 });
    }
}
