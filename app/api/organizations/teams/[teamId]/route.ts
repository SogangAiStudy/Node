import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireOrgAdmin } from "@/lib/utils/permissions";
import { z } from "zod";

const updateTeamSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
});

/**
 * PATCH /api/organizations/teams/[teamId]
 * Update team details
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    try {
        const user = await requireAuth();
        const { teamId } = await params;
        const body = await request.json();
        const { name, description } = updateTeamSchema.parse(body);

        const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { orgId: true, isDefault: true }
        });

        if (!team) {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        await requireOrgAdmin(team.orgId, user.id);

        const updatedTeam = await prisma.team.update({
            where: { id: teamId },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description }),
            },
        });

        return NextResponse.json({ team: updatedTeam });
    } catch (error) {
        console.error("PATCH team error:", error);
        if (error instanceof Error && error.message === "Organization admin access required") {
            return NextResponse.json({ error: "Only admins can update teams" }, { status: 403 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * DELETE /api/organizations/teams/[teamId]
 * Delete a team
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    try {
        const user = await requireAuth();
        const { teamId } = await params;

        const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { id: true, orgId: true, name: true, isDefault: true }
        });

        if (!team) {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        await requireOrgAdmin(team.orgId, user.id);

        if (team.isDefault) {
            return NextResponse.json({ error: "The default team cannot be deleted" }, { status: 409 });
        }

        const [primaryProjectCount, projectAssignmentCount, nodeCount, nodeTeamCount, openRequestCount] = await Promise.all([
            prisma.project.count({ where: { primaryTeamId: teamId } }),
            prisma.projectTeam.count({ where: { teamId } }),
            prisma.node.count({ where: { teamId } }),
            prisma.nodeTeam.count({ where: { teamId } }),
            prisma.request.count({
                where: {
                    orgId: team.orgId,
                    status: { not: "CLOSED" },
                    OR: [
                        { targetTeamId: teamId },
                        { toTeam: team.name },
                    ],
                },
            }),
        ]);

        if (primaryProjectCount > 0 || projectAssignmentCount > 0 || nodeCount > 0 || nodeTeamCount > 0 || openRequestCount > 0) {
            return NextResponse.json({
                error: "This team is still referenced and cannot be deleted",
                details: {
                    primaryProjectCount,
                    projectAssignmentCount,
                    nodeCount,
                    nodeTeamCount,
                    openRequestCount,
                },
            }, { status: 409 });
        }

        await prisma.team.delete({
            where: { id: teamId }
        });

        return NextResponse.json({ message: "Team deleted successfully" });
    } catch (error) {
        console.error("DELETE team error:", error);
        if (error instanceof Error && error.message === "Organization admin access required") {
            return NextResponse.json({ error: "Only admins can delete teams" }, { status: 403 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
