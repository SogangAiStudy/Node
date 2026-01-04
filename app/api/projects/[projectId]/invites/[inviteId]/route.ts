import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { isProjectAdmin } from "@/lib/utils/permissions";

export const dynamic = "force-dynamic";

interface RouteContext {
    params: Promise<{ projectId: string; inviteId: string }>;
}

// DELETE /api/projects/[projectId]/invites/[inviteId] - Revoke Invite
export async function DELETE(
    req: NextRequest,
    context: RouteContext
) {
    try {
        const user = await requireAuth();
        const { projectId, inviteId } = await context.params;

        // Check Auth
        const isAdmin = await isProjectAdmin(projectId, user.id);

        // Fetch invite to check if user is the sender (optional, but good for self-revoke if not admin?)
        // For now, restrict to Admins/Owners. Or sender?
        // Let's stick to isProjectAdmin for simplicity.

        if (!isAdmin) {
            // Also allow the inviter to revoke their own invite?
            // Need to fetch invite first.
            const invite = await prisma.projectInvite.findUnique({ where: { id: inviteId } });
            if (!invite) return NextResponse.json({ success: true });

            if (invite.invitedByUserId !== user.id) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
            }
        }

        await prisma.projectInvite.delete({
            where: { id: inviteId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        if ((error as any).code === 'P2025') return NextResponse.json({ success: true });
        return NextResponse.json({ error: "Failed to revoke invite" }, { status: 500 });
    }
}
