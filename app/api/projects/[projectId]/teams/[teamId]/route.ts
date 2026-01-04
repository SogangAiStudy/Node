import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { isProjectAdmin } from "@/lib/utils/permissions";
import { ProjectRole } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

interface RouteContext {
    params: Promise<{ projectId: string; teamId: string }>;
}

const UpdateTeamRoleSchema = z.object({
    role: z.enum([
        ProjectRole.PROJECT_ADMIN,
        ProjectRole.EDITOR,
        ProjectRole.VIEWER
    ]),
});

// PATCH /api/projects/[projectId]/teams/[teamId] - Update team role
export async function PATCH(
    req: NextRequest,
    context: RouteContext
) {
    try {
        const user = await requireAuth();
        const { projectId, teamId } = await context.params;
        const body = await req.json();

        // Check Auth
        const isAdmin = await isProjectAdmin(projectId, user.id);
        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { role } = UpdateTeamRoleSchema.parse(body);

        const updated = await prisma.projectTeam.update({
            where: {
                projectId_teamId: {
                    projectId,
                    teamId,
                },
            },
            data: { role },
        });

        return NextResponse.json(updated);
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid data" }, { status: 400 });
        return NextResponse.json({ error: "Failed to update team role" }, { status: 500 });
    }
}

// DELETE /api/projects/[projectId]/teams/[teamId] - Remove team from project
export async function DELETE(
    req: NextRequest,
    context: RouteContext
) {
    try {
        const user = await requireAuth();
        const { projectId, teamId } = await context.params;

        // Check Auth
        const isAdmin = await isProjectAdmin(projectId, user.id);
        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        await prisma.projectTeam.delete({
            where: {
                projectId_teamId: {
                    projectId,
                    teamId,
                },
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        if ((error as any).code === 'P2025') return NextResponse.json({ success: true });
        return NextResponse.json({ error: "Failed to remove team" }, { status: 500 });
    }
}
