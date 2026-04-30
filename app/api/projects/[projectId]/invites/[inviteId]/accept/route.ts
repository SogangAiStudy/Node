import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

interface RouteContext {
    params: Promise<{ projectId: string; inviteId: string }>;
}

// POST /api/projects/[projectId]/invites/[inviteId]/accept
export async function POST(
    req: NextRequest,
    context: RouteContext
) {
    try {
        const user = await requireAuth();
        const { projectId, inviteId } = await context.params;

        // 1. Fetch Invite
        const invite = await prisma.projectInvite.findUnique({
            where: { id: inviteId },
        });

        if (!invite) {
            return NextResponse.json({ error: "Invite not found" }, { status: 404 });
        }

        // 2. Validate Invite
        if (invite.projectId !== projectId) {
            return NextResponse.json({ error: "Invalid invite for this project" }, { status: 400 });
        }

        if (invite.status !== 'PENDING') {
            return NextResponse.json({ error: "Invite is not pending" }, { status: 400 });
        }

        // 3. Verify target user matches current user 
        // (Invites are created for a specific user ID usually, but if by email, we might check email?)
        // Schema says: targetUserId String.
        if (invite.targetUserId !== user.id) {
            return NextResponse.json({ error: "This invite is not for you" }, { status: 403 });
        }

        const orgMembership = await prisma.orgMember.findUnique({
            where: {
                orgId_userId: {
                    orgId: invite.orgId,
                    userId: user.id,
                },
            },
            select: { status: true },
        });

        if (!orgMembership || !["ACTIVE", "PENDING_TEAM_ASSIGNMENT"].includes(orgMembership.status)) {
            return NextResponse.json({ error: "You must be an active workspace member to accept this invite" }, { status: 403 });
        }

        // 4. Accept Invite Transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create Member
            const member = await tx.projectMember.create({
                data: {
                    orgId: invite.orgId,
                    projectId: invite.projectId,
                    userId: user.id,
                    role: invite.role,
                }
            });

            // Update Invite Status
            await tx.projectInvite.update({
                where: { id: inviteId },
                data: {
                    status: 'ACCEPTED',
                    respondedAt: new Date(),
                }
            });

            return member;
        });

        return NextResponse.json(result);

    } catch (error) {
        console.error("Accept Invite Error:", error);
        // Handle unique constraint violation (already member)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return NextResponse.json({ error: "You are already a member" }, { status: 409 });
        }
        return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 });
    }
}
