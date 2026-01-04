import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { isProjectAdmin } from "@/lib/utils/permissions";
import { z } from "zod";
import { ProjectRole } from "@prisma/client";

export const dynamic = "force-dynamic";

interface RouteContext {
    params: Promise<{ projectId: string; userId: string }>;
}

const UpdateRoleSchema = z.object({
    role: z.enum([
        ProjectRole.PROJECT_ADMIN,
        ProjectRole.EDITOR,
        ProjectRole.VIEWER
    ]),
});

// PATCH /api/projects/[projectId]/members/[userId] - Update member role
export async function PATCH(
    req: NextRequest,
    context: RouteContext
) {
    try {
        const user = await requireAuth();
        const { projectId, userId: targetUserId } = await context.params;
        const body = await req.json();

        // 1. Check Auth (Must be Project Admin/Owner)
        const isAdmin = await isProjectAdmin(projectId, user.id);
        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { role } = UpdateRoleSchema.parse(body);

        // 2. Prevent changing role of the Owner (if target is owner)
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true }
        });

        if (project?.ownerId === targetUserId) {
            return NextResponse.json({ error: "Cannot change role of the project owner" }, { status: 403 });
        }

        // 3. Update member role
        const updated = await prisma.projectMember.update({
            where: {
                projectId_userId: {
                    projectId,
                    userId: targetUserId,
                },
            },
            data: {
                role: role,
            },
        });

        return NextResponse.json({ member: updated });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Invalid request data", details: error.issues },
                { status: 400 }
            );
        }

        console.error("Error updating member role:", error);
        return NextResponse.json(
            { error: "Failed to update role" },
            { status: 500 }
        );
    }
}

// DELETE /api/projects/[projectId]/members/[userId] - Remove member
export async function DELETE(
    req: NextRequest,
    context: RouteContext
) {
    try {
        const user = await requireAuth();
        const { projectId, userId: targetUserId } = await context.params;

        // 1. Check Auth (Must be Project Admin or LEAVING themselves)
        const isAdmin = await isProjectAdmin(projectId, user.id);
        const isSelf = user.id === targetUserId;

        if (!isAdmin && !isSelf) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        // 2. Prevent removing the Owner
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true }
        });

        if (project?.ownerId === targetUserId) {
            return NextResponse.json({ error: "Cannot remove the project owner" }, { status: 403 });
        }

        // 3. Remove member
        await prisma.projectMember.delete({
            where: {
                projectId_userId: {
                    projectId,
                    userId: targetUserId,
                },
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        // Handle "Record to delete does not exist" gracefully
        if ((error as any).code === 'P2025') {
            return NextResponse.json({ success: true }); // Idempotent
        }

        console.error("Error removing member:", error);
        return NextResponse.json(
            { error: "Failed to remove member" },
            { status: 500 }
        );
    }
}
