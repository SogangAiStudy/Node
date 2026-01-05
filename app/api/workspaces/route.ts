import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

/**
 * Check if an organization has unread inbox items for a user and return the count
 */
async function getUnreadInboxCount(orgId: string, userId: string): Promise<number> {
  const inboxState = await prisma.orgInboxState.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId,
      },
    },
  });

  const lastSeenAt = inboxState?.lastSeenAt || new Date(0);

  // Get user's teams in this org
  const userTeams = await prisma.teamMember.findMany({
    where: {
      orgId,
      userId,
    },
    select: {
      teamId: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const teamNames = userTeams.map((tm: any) => tm.team?.name).filter((name): name is string => !!name);
  const userTeamIds = userTeams.map((tm: any) => tm.teamId).filter((id): id is string => !!id);

  // Count unread requests, notifications, and invites
  // Note: We don't filter by lastSeenAt here because we want to count ALL unread items
  const [unreadRequests, unreadNotifications, unreadInvites] = await Promise.all([
    prisma.request.count({
      where: {
        orgId,
        OR: [
          { toUserId: userId },
          { toTeam: { in: teamNames } },
        ],
        status: {
          not: "CLOSED",
        },
      },
    }),
    prisma.notification.count({
      where: {
        orgId,
        OR: [
          { userId, targetType: "USER" },
          { targetType: "TEAM", targetTeamId: { in: userTeamIds } }
        ],
        isRead: false,
      },
    }),
    prisma.projectInvite.count({
      where: {
        orgId,
        targetUserId: userId,
        status: "PENDING",
      },
    }),
  ]);

  return unreadRequests + unreadNotifications + unreadInvites;
}

// GET /api/workspaces - Get all user's workspaces with unread inbox indicator
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    console.log(`[DEBUG] GET /api/workspaces - User: ${user.email} (${user.id})`);

    // Get all organizations where user is a member (any status)
    let orgMemberships = await prisma.orgMember.findMany({
      where: {
        userId: user.id,
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

    // AUTO-PROVISIONING: If user has no workspaces, join the "👋 Getting Started" workspace
    if (orgMemberships.length === 0) {
      console.log(`[DEBUG] No workspaces found for ${user.email}. Attaching to "Getting Started" onboarding workspace...`);

      const validUserId = user.id;
      const demoOrgId = "demo-org-id";

      try {
        await prisma.$transaction(async (tx: any) => {
          // 1. Join the "Getting Started" Organization
          await tx.orgMember.upsert({
            where: {
              orgId_userId: {
                orgId: demoOrgId,
                userId: validUserId,
              },
            },
            update: { status: "ACTIVE" },
            create: {
              orgId: demoOrgId,
              userId: validUserId,
              role: "MEMBER",
              status: "ACTIVE",
            },
          });

          // 2. Create Inbox State
          await tx.orgInboxState.upsert({
            where: {
              orgId_userId: {
                orgId: demoOrgId,
                userId: validUserId,
              },
            },
            update: {},
            create: {
              orgId: demoOrgId,
              userId: validUserId,
            },
          });

          // 3. Join Frontend Team (Frontend Studio)
          await tx.teamMember.upsert({
            where: {
              orgId_teamId_userId: {
                orgId: demoOrgId,
                teamId: "team-frontend",
                userId: validUserId,
              },
            },
            update: { role: "MEMBER" },
            create: {
              orgId: demoOrgId,
              teamId: "team-frontend",
              userId: validUserId,
              role: "MEMBER",
            },
          });

          // 4. Join the Onboarding Project
          await tx.projectMember.upsert({
            where: {
              projectId_userId: {
                projectId: "onboarding-project-id",
                userId: validUserId,
              },
            },
            update: { role: "PROJECT_ADMIN" },
            create: {
              orgId: demoOrgId,
              projectId: "onboarding-project-id",
              userId: validUserId,
              role: "PROJECT_ADMIN",
            },
          });

          // 5. Assign to QA Node (node-7-qa)
          await tx.nodeOwner.upsert({
            where: {
              nodeId_userId: {
                nodeId: "node-7-qa",
                userId: validUserId,
              },
            },
            update: {},
            create: {
              nodeId: "node-7-qa",
              userId: validUserId,
            },
          });
        });

        // Re-fetch memberships
        orgMemberships = await prisma.orgMember.findMany({
          where: { userId: user.id },
          include: {
            organization: {
              select: { id: true, name: true },
            },
          },
        });
      } catch (err) {
        console.error("Failed to auto-join onboarding workspace:", err);
        // Fallback or error
      }
    }

    console.log(`[DEBUG] GET /api/workspaces - Found ${orgMemberships.length} memberships`);

    // For each org, check unread inbox count
    const workspaces = await Promise.all(
      orgMemberships.map(async (m: any) => {
        let unreadCount = 0;
        if (["ACTIVE", "PENDING_TEAM_ASSIGNMENT"].includes(m.status)) {
          unreadCount = await getUnreadInboxCount(m.orgId, user.id);
        }
        return {
          orgId: m.orgId,
          name: m.organization.name,
          status: m.status,
          hasUnreadInbox: unreadCount > 0,
          unreadCount,
        };
      })
    );

    console.log(`[DEBUG] GET /api/workspaces - Returning ${workspaces.length} workspaces`);
    return NextResponse.json(workspaces);
  } catch (error) {
    console.error("GET /api/workspaces error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 }
    );
  }
}
