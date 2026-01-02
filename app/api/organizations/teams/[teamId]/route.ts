import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
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
            select: { orgId: true }
        });

        if (!team) {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        const orgMember = await prisma.orgMember.findUnique({
            where: {
                orgId_userId: {
                    orgId: team.orgId,
                    userId: user.id,
                },
            },
        });

        if (!orgMember || orgMember.role !== "ADMIN") {
            return NextResponse.json({ error: "Only admins can update teams" }, { status: 403 });
        }

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
            select: { orgId: true }
        });

        if (!team) {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        const orgMember = await prisma.orgMember.findUnique({
            where: {
                orgId_userId: {
                    orgId: team.orgId,
                    userId: user.id,
                },
            },
        });

        if (!orgMember || orgMember.role !== "ADMIN") {
            return NextResponse.json({ error: "Only admins can delete teams" }, { status: 403 });
        }

        await prisma.team.delete({
            where: { id: teamId }
        });

        return NextResponse.json({ message: "Team deleted successfully" });
    } catch (error) {
        console.error("DELETE team error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
