import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";

// GET /api/projects/[projectId]/access
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const user = await requireAuth();
        const { projectId } = await params;

        // Verify access
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                organization: true,
            },
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Check if user has access to this project
        // (Simplification: If they are in the org, let's allow them to see access info for now,
        // or strictly enforce membership. Let's enforce basic read access logic like "can view project")
        // For now, let's assume if you can call this, you have passed middleware or basic checks.
        // But strict check:
        const orgMember = await prisma.orgMember.findUnique({
            where: {
                orgId_userId: {
                    orgId: project.orgId,
                    userId: user.id,
                },
            },
        });

        if (!orgMember) {
            return NextResponse.json({ error: "No access" }, { status: 403 });
        }

        // Fetch all related data
        const [projectMembers, projectTeams, invites] = await Promise.all([
            // Direct Members
            prisma.projectMember.findMany({
                where: { projectId },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            image: true,
                        },
                    },
                },
                orderBy: { createdAt: "asc" },
            }),
            // Assigned Teams
            prisma.projectTeam.findMany({
                where: { projectId },
                include: {
                    team: {
                        include: {
                            _count: {
                                select: { members: true },
                            },
                        },
                    },
                },
                orderBy: { createdAt: "asc" },
            }),
            // Pending Invites
            prisma.projectInvite.findMany({
                where: {
                    projectId,
                    status: "PENDING",
                },
                include: {
                    targetUser: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            image: true,
                        },
                    },
                    invitedBy: {
                        select: {
                            name: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
        ]);

        // Available Teams (for the "Add Team" picker) - filtering out already added teams
        const assignedTeamIds = projectTeams.map((pt) => pt.teamId);
        const availableTeams = await prisma.team.findMany({
            where: {
                orgId: project.orgId,
                id: { notIn: assignedTeamIds },
            },
            select: {
                id: true,
                name: true,
                _count: {
                    select: { members: true },
                },
            },
        });

        return NextResponse.json({
            members: projectMembers.map((pm) => ({
                id: pm.id,
                userId: pm.userId,
                name: pm.user.name,
                email: pm.user.email,
                image: pm.user.image,
                role: pm.role,
                isDirectMember: true,
            })),
            teams: projectTeams.map((pt) => ({
                id: pt.id,
                teamId: pt.teamId,
                name: pt.team.name,
                role: pt.role,
                memberCount: pt.team._count.members,
            })),
            invites: invites.map((inv) => ({
                id: inv.id,
                email: inv.targetUser.email,
                name: inv.targetUser.name,
                image: inv.targetUser.image,
                invitedBy: inv.invitedBy.name,
                status: inv.status,
                createdAt: inv.createdAt,
            })),
            availableTeams: availableTeams.map((t) => ({
                id: t.id,
                name: t.name,
                memberCount: t._count.members,
            })),
        });
    } catch (error) {
        console.error("GET /api/projects/[id]/access error:", error);
        return NextResponse.json({ error: "Failed to fetch access data" }, { status: 500 });
    }
}
