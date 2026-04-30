import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { assignToDefaultTeam } from "@/lib/utils/teams";
import { createNotification } from "@/lib/utils/notifications";
import { ACTIVE_ORG_MEMBER_STATUSES, getActiveOrgMembership } from "@/lib/utils/permissions";
import { z } from "zod";

const UpdateMemberSchema = z.object({
    orgId: z.string().min(1, "Organization ID is required"),
    role: z.enum(["ADMIN", "MEMBER"]).optional(),
    status: z.enum(["ACTIVE", "PENDING_TEAM_ASSIGNMENT", "DEACTIVATED", "PENDING_APPROVAL"]).optional(),
    teamIds: z.array(z.string()).optional(),
});

const DeleteMemberSchema = z.object({
    orgId: z.string().min(1, "Organization ID is required"),
});

async function ensureAdmin(orgId: string, userId: string) {
    const membership = await getActiveOrgMembership(orgId, userId);
    if (!membership || membership.role !== "ADMIN") {
        throw new Error("Only organization admins can manage members");
    }
}

async function getActiveAdminCount(orgId: string) {
    return prisma.orgMember.count({
        where: {
            orgId,
            role: "ADMIN",
            status: { in: [...ACTIVE_ORG_MEMBER_STATUSES] },
        },
    });
}

/**
 * PATCH /api/organizations/members/[userId]
 * Update a member's role, status, and team assignments within a specific organization.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId: targetUserId } = await params;
        const currentUser = await requireAuth();
        const body = await request.json();
        const { role, status, teamIds, orgId } = UpdateMemberSchema.parse(body);

        await ensureAdmin(orgId, currentUser.id);

        const [organization, targetOrgMember] = await Promise.all([
            prisma.organization.findUnique({
                where: { id: orgId },
                select: { id: true, name: true, ownerId: true },
            }),
            prisma.orgMember.findUnique({
                where: {
                    orgId_userId: {
                        orgId,
                        userId: targetUserId,
                    },
                },
            }),
        ]);

        if (!organization) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        if (!targetOrgMember) {
            return NextResponse.json({ error: "User not found in this organization" }, { status: 404 });
        }

        if (organization.ownerId === targetUserId) {
            return NextResponse.json({ error: "The workspace owner cannot be modified here" }, { status: 403 });
        }

        if (teamIds) {
            const validTeamCount = await prisma.team.count({
                where: {
                    orgId,
                    id: { in: teamIds },
                },
            });

            if (validTeamCount !== teamIds.length) {
                return NextResponse.json({ error: "One or more selected teams do not belong to this workspace" }, { status: 400 });
            }
        }

        const nextRole = role ?? targetOrgMember.role;
        let finalStatus = status ?? targetOrgMember.status;

        if (teamIds && teamIds.length > 0 && ["PENDING_TEAM_ASSIGNMENT", "PENDING_APPROVAL"].includes(targetOrgMember.status)) {
            finalStatus = "ACTIVE";
        }

        const targetIsActiveAdmin =
            targetOrgMember.role === "ADMIN" &&
            ACTIVE_ORG_MEMBER_STATUSES.includes(targetOrgMember.status as (typeof ACTIVE_ORG_MEMBER_STATUSES)[number]);
        const remainsActiveAdmin =
            nextRole === "ADMIN" &&
            ACTIVE_ORG_MEMBER_STATUSES.includes(finalStatus as (typeof ACTIVE_ORG_MEMBER_STATUSES)[number]);

        if (targetIsActiveAdmin && !remainsActiveAdmin) {
            const activeAdminCount = await getActiveAdminCount(orgId);
            if (activeAdminCount <= 1) {
                return NextResponse.json({ error: "You cannot remove or deactivate the last active workspace admin" }, { status: 409 });
            }
        }

        await prisma.$transaction(async (tx) => {
            if (role || status || teamIds) {
                await tx.orgMember.update({
                    where: {
                        orgId_userId: {
                            orgId,
                            userId: targetUserId,
                        },
                    },
                    data: {
                        ...(role && { role }),
                        ...(finalStatus && { status: finalStatus }),
                    },
                });
            }

            if (teamIds) {
                await tx.teamMember.deleteMany({
                    where: {
                        orgId,
                        userId: targetUserId,
                    },
                });

                if (teamIds.length > 0) {
                    await tx.teamMember.createMany({
                        data: teamIds.map((teamId) => ({
                            orgId,
                            teamId,
                            userId: targetUserId,
                            role: "MEMBER",
                        })),
                    });
                } else if (!status && targetOrgMember.status === "ACTIVE") {
                    await tx.orgMember.update({
                        where: {
                            orgId_userId: {
                                orgId,
                                userId: targetUserId,
                            },
                        },
                        data: {
                            status: "PENDING_TEAM_ASSIGNMENT",
                        },
                    });
                    finalStatus = "PENDING_TEAM_ASSIGNMENT";
                }
            }
        });

        if (teamIds && teamIds.length > 0) {
            const assignedTeams = await prisma.team.findMany({
                where: {
                    id: { in: teamIds },
                },
                select: {
                    id: true,
                    name: true,
                },
            });

            for (const team of assignedTeams) {
                await createNotification({
                    userId: targetUserId,
                    orgId,
                    type: "TEAM_ASSIGNED",
                    title: "Added to Team",
                    message: `You have been added to the team "${team.name}".`,
                    dedupeKey: `TEAM_JOIN:${team.id}:${targetUserId}`,
                });
            }
        }

        if (finalStatus === "ACTIVE") {
            await assignToDefaultTeam(orgId, targetUserId);

            await createNotification({
                userId: targetUserId,
                orgId,
                type: "SYSTEM",
                title: "Access Approved",
                message: `You have been approved to join ${organization.name}.`,
                dedupeKey: `ORG_APPROVED:${orgId}:${targetUserId}`,
            });
        }

        return NextResponse.json({ message: "Member updated successfully" });
    } catch (error) {
        console.error("PATCH /api/organizations/members error:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid data", details: error.flatten() }, { status: 400 });
        }
        if (error instanceof Error && error.message === "Only organization admins can manage members") {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
    }
}

/**
 * DELETE /api/organizations/members/[userId]
 * Permanently remove a member from a workspace while preserving app-wide user history.
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId: targetUserId } = await params;
        const currentUser = await requireAuth();
        const body = await request.json();
        const { orgId } = DeleteMemberSchema.parse(body);

        await ensureAdmin(orgId, currentUser.id);

        const [organization, targetOrgMember, ownedProjectCount] = await Promise.all([
            prisma.organization.findUnique({
                where: { id: orgId },
                select: { id: true, ownerId: true },
            }),
            prisma.orgMember.findUnique({
                where: {
                    orgId_userId: {
                        orgId,
                        userId: targetUserId,
                    },
                },
            }),
            prisma.project.count({
                where: {
                    orgId,
                    ownerId: targetUserId,
                },
            }),
        ]);

        if (!organization) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        if (!targetOrgMember) {
            return NextResponse.json({ error: "User not found in this organization" }, { status: 404 });
        }

        if (organization.ownerId === targetUserId) {
            return NextResponse.json({ error: "Transfer workspace ownership before removing this member" }, { status: 409 });
        }

        if (ownedProjectCount > 0) {
            return NextResponse.json({ error: "Transfer ownership of this member's projects before removing them" }, { status: 409 });
        }

        const targetIsActiveAdmin =
            targetOrgMember.role === "ADMIN" &&
            ACTIVE_ORG_MEMBER_STATUSES.includes(targetOrgMember.status as (typeof ACTIVE_ORG_MEMBER_STATUSES)[number]);
        if (targetIsActiveAdmin) {
            const activeAdminCount = await getActiveAdminCount(orgId);
            if (activeAdminCount <= 1) {
                return NextResponse.json({ error: "You cannot remove the last active workspace admin" }, { status: 409 });
            }
        }

        await prisma.$transaction(async (tx) => {
            await tx.node.updateMany({
                where: {
                    orgId,
                    ownerId: targetUserId,
                },
                data: {
                    ownerId: null,
                },
            });

            await tx.nodeOwner.deleteMany({
                where: {
                    userId: targetUserId,
                    node: {
                        orgId,
                    },
                },
            });

            await tx.request.updateMany({
                where: {
                    orgId,
                    toUserId: targetUserId,
                },
                data: {
                    toUserId: null,
                    claimedAt: null,
                },
            });

            await tx.projectInvite.deleteMany({
                where: {
                    orgId,
                    OR: [
                        { targetUserId: targetUserId },
                        { invitedByUserId: targetUserId },
                    ],
                },
            });

            await tx.projectMember.deleteMany({
                where: {
                    orgId,
                    userId: targetUserId,
                },
            });

            await tx.orgInboxState.deleteMany({
                where: {
                    orgId,
                    userId: targetUserId,
                },
            });

            await tx.notification.deleteMany({
                where: {
                    orgId,
                    userId: targetUserId,
                },
            });

            await tx.teamMember.deleteMany({
                where: {
                    orgId,
                    userId: targetUserId,
                },
            });

            await tx.orgMember.delete({
                where: {
                    orgId_userId: {
                        orgId,
                        userId: targetUserId,
                    },
                },
            });
        });

        return NextResponse.json({ message: "Member removed from workspace" });
    } catch (error) {
        console.error("DELETE /api/organizations/members error:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid data", details: error.flatten() }, { status: 400 });
        }
        if (error instanceof Error && error.message === "Only organization admins can manage members") {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
    }
}
