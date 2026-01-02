import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isOrgAdmin } from "@/lib/utils/auth";
import { z } from "zod";

const UpdateMemberSchema = z.object({
    orgId: z.string().min(1, "Organization ID is required"),
    role: z.enum(["ADMIN", "MEMBER"]).optional(),
    status: z.enum(["ACTIVE", "PENDING_TEAM_ASSIGNMENT", "DEACTIVATED", "PENDING_APPROVAL"]).optional(),
    teamIds: z.array(z.string()).optional(),
});

/**
 * PATCH /api/organizations/members/[userId]
 * Update a member's role, status, and team assignments within a specific organization
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

        // Get currentUser's organization and check if they are admin
        const currentOrgMember = await prisma.orgMember.findUnique({
            where: {
                orgId_userId: {
                    orgId,
                    userId: currentUser.id,
                },
            },
            select: {
                orgId: true,
                role: true,
            },
        });

        if (!currentOrgMember || currentOrgMember.role !== "ADMIN") {
            return NextResponse.json(
                { error: "Only organization admins can manage members" },
                { status: 403 }
            );
        }

        // Check if target user is in the same organization
        const targetOrgMember = await prisma.orgMember.findUnique({
            where: {
                orgId_userId: {
                    orgId,
                    userId: targetUserId,
                },
            },
        });

        if (!targetOrgMember) {
            return NextResponse.json(
                { error: "User not found in this organization" },
                { status: 404 }
            );
        }

        let finalStatus = status; // Initialize finalStatus with the provided status

        // If teams are being updated, auto-update status to ACTIVE if it was PENDING
        if (teamIds && teamIds.length > 0 &&
            (targetOrgMember.status === "PENDING_TEAM_ASSIGNMENT" || targetOrgMember.status === "PENDING_APPROVAL")) {
            finalStatus = "ACTIVE";
        }

        // Perform updates in a transaction
        await prisma.$transaction(async (tx: any) => {
            // 1. Update OrgMember role and status
            if (role || finalStatus) {
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

            // 2. Update Team memberships if provided
            if (teamIds) {
                // Remove existing team memberships in this org
                await tx.teamMember.deleteMany({
                    where: {
                        orgId,
                        userId: targetUserId,
                    },
                });

                // Add new team memberships
                if (teamIds.length > 0) {
                    await tx.teamMember.createMany({
                        data: teamIds.map((teamId) => ({
                            orgId,
                            teamId,
                            userId: targetUserId,
                            role: "MEMBER", // Default to regular member for now
                        })),
                    });
                } else if (!finalStatus && targetOrgMember.status === "ACTIVE") {
                    // If all teams removed and no status provided, maybe set back to PENDING?
                    // Let's stick to the manual logic: status tracker whether user has been assigned to any team
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
                }
            }
        });

        return NextResponse.json({ message: "Member updated successfully" });
    } catch (error) {
        console.error("PATCH /api/organizations/members error:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid data", details: error.flatten() }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to update member" },
            { status: 500 }
        );
    }
}
