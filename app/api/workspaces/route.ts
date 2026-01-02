import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";

// GET /api/workspaces - Get all user's workspaces with unread inbox indicator
export async function GET() {
  try {
    const user = await requireAuth();

    // Get all organizations where user is a member
    const orgMemberships = await prisma.orgMember.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // For each org, check if there are unread inbox items
    const workspaces = await Promise.all(
      orgMemberships.map(async (membership) => {
        const orgId = membership.orgId;

        // Get user's inbox state for this org
        const inboxState = await prisma.orgInboxState.findUnique({
          where: {
            orgId_userId: {
              orgId,
              userId: user.id,
            },
          },
        });

        const lastSeenAt = inboxState?.lastSeenAt;

        // Get user's teams in this org
        const userTeams = await prisma.teamMember.findMany({
          where: {
            orgId,
            userId: user.id,
          },
          select: {
            team: {
              select: {
                name: true,
              },
            },
          },
        });

        const teamNames = userTeams.map((tm) => tm.team.name);

        // Check for unread requests
        // A request is unread if:
        // - assigned to user OR assigned to user's team
        // - AND status != CLOSED
        // - AND (no lastSeenAt OR updatedAt > lastSeenAt)
        const unreadCount = await prisma.request.findMany({
          where: {
            orgId,
            OR: [
              { toUserId: user.id },
              { toTeam: { in: teamNames } },
            ],
            status: {
              not: "CLOSED",
            },
            ...(lastSeenAt && {
              updatedAt: {
                gt: lastSeenAt,
              },
            }),
          },
          select: {
            id: true,
          },
        });

        return {
          orgId: membership.organization.id,
          name: membership.organization.name,
          hasUnreadInbox: unreadCount.length > 0,
        };
      })
    );

    return NextResponse.json(workspaces);
  } catch (error) {
    console.error("GET /api/workspaces error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 }
    );
  }
}
