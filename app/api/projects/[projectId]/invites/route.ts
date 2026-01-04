import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { isProjectAdmin } from "@/lib/utils/permissions";
import { z } from "zod";

const InviteSchema = z.object({
    email: z.string().email(),
    role: z.enum(["PROJECT_ADMIN", "EDITOR", "VIEWER"]).default("EDITOR"),
});

// POST /api/projects/[projectId]/invites
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const user = await requireAuth();
        const { projectId } = await params;
        const body = await request.json();
        const validated = InviteSchema.parse(body);

        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

        // Check permissions (Owner or Project Admin)
        const isAdmin = await isProjectAdmin(projectId, user.id);
        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        // Find target user by email
        const targetUser = await prisma.user.findUnique({
            where: { email: validated.email },
        });

        if (!targetUser) {
            // Allow inviting non-existent users? 
            // Plan said: "Invite User (approval required)", "Create ProjectInvite(status=PENDING)".
            // If user doesn't exist in system, we can't create relation to User.
            // For MVP, invite only existing users.
            return NextResponse.json(
                { error: "User not found. Please ask them to sign up first." },
                { status: 404 }
            );
        }

        // Check if already a member
        const existingMember = await prisma.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId: targetUser.id,
                },
            },
        });

        if (existingMember) {
            return NextResponse.json({ error: "User is already a member" }, { status: 409 });
        }

        // Check for existing pending invite
        const existingInvite = await prisma.projectInvite.findUnique({
            where: {
                projectId_targetUserId: {
                    projectId,
                    targetUserId: targetUser.id,
                },
            },
        });

        if (existingInvite) {
            if (existingInvite.status === 'PENDING') {
                return NextResponse.json({ error: "Invite already pending" }, { status: 409 });
            }
            // If CANCELED/DECLINED, we can re-invite.
            // Delete old invite to create new one or update it?
            // Simple: delete old one.
            await prisma.projectInvite.delete({ where: { id: existingInvite.id } });
        }

        // Create Invite
        const invite = await prisma.projectInvite.create({
            data: {
                orgId: project.orgId,
                projectId,
                invitedByUserId: user.id,
                targetUserId: targetUser.id,
                status: "PENDING",
            },
        });

        // TODO: Send email notification

        return NextResponse.json(invite);
    } catch (error) {
        console.error("POST Invite error:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to invite" }, { status: 500 });
    }
}
