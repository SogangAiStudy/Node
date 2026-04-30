import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { isProjectAdmin, requireProjectView } from "@/lib/utils/permissions";

// GET /api/projects/[projectId]/access
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const user = await requireAuth();
        const { projectId } = await params;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: {
                id: true,
                orgId: true,
                ownerId: true,
            },
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        await requireProjectView(projectId, user.id);
        const canManageAccess = await isProjectAdmin(projectId, user.id);

        // Fetch all related data
        const [projectMembers, projectTeams, invites] = await Promise.all([
            // Direct Members
            prisma.projectMember.findMany({
                where: {
                    projectId,
                    user: {
                        orgMemberships: {
                            some: {
                                orgId: project.orgId,
                                status: { in: ["ACTIVE", "PENDING_TEAM_ASSIGNMENT"] },
                            },
                        },
                    },
                },
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
                            members: {
                                where: {
                                    user: {
                                        orgMemberships: {
                                            some: {
                                                orgId: project.orgId,
                                                status: { in: ["ACTIVE", "PENDING_TEAM_ASSIGNMENT"] },
                                            },
                                        },
                                    },
                                },
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
                memberCount: pt.team.members.length,
            })),
            invites: invites.map((inv) => ({
                id: inv.id,
                email: inv.targetUser.email,
                name: inv.targetUser.name,
                image: inv.targetUser.image,
                invitedBy: inv.invitedBy.name,
                role: inv.role,
                status: inv.status,
                createdAt: inv.createdAt,
            })),
            availableTeams: availableTeams.map((t) => ({
                id: t.id,
                name: t.name,
                memberCount: t._count.members,
            })),
            permissions: {
                canManageAccess,
            },
        });
    } catch (error) {
        console.error("GET /api/projects/[id]/access error:", error);
        if (error instanceof Error && error.message === "Not authorized to view this project") {
            return NextResponse.json({ error: "No access" }, { status: 403 });
        }
        return NextResponse.json({ error: "Failed to fetch access data" }, { status: 500 });
    }
}
