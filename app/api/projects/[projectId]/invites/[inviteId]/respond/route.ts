import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { z } from "zod";

const RespondInviteSchema = z.object({
    accept: z.boolean(),
});

export const dynamic = "force-dynamic";

interface RouteContext {
    params: Promise<{ projectId: string; inviteId: string }>;
}

// PATCH /api/projects/[projectId]/invites/[inviteId]/respond
export async function PATCH(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const user = await requireAuth();
        const { projectId, inviteId } = await context.params;
        const body = await request.json();
        const { accept } = RespondInviteSchema.parse(body);

        const invite = await prisma.projectInvite.findUnique({
            where: { id: inviteId },
        });

        if (!invite || invite.projectId !== projectId) {
            return NextResponse.json({ error: "Invite not found" }, { status: 404 });
        }

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
            return NextResponse.json({ error: "You must be an active workspace member to respond to this invite" }, { status: 403 });
        }

        if (invite.status !== "PENDING") {
            return NextResponse.json({ error: "Invite is no longer pending" }, { status: 400 });
        }

        if (!accept) {
            const declinedInvite = await prisma.projectInvite.update({
                where: { id: inviteId },
                data: {
                    status: "DECLINED",
                    respondedAt: new Date(),
                },
            });

            return NextResponse.json(declinedInvite);
        }

        const result = await prisma.$transaction(async (tx) => {
            const member = await tx.projectMember.upsert({
                where: {
                    projectId_userId: {
                        projectId: invite.projectId,
                        userId: user.id,
                    },
                },
                update: {
                    role: invite.role,
                },
                create: {
                    orgId: invite.orgId,
                    projectId: invite.projectId,
                    userId: user.id,
                    role: invite.role,
                },
            });

            await tx.projectInvite.update({
                where: { id: inviteId },
                data: {
                    status: "ACCEPTED",
                    respondedAt: new Date(),
                },
            });

            return member;
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("PATCH project invite respond error:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid request data", details: error.issues }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to respond to invite" }, { status: 500 });
    }
}
