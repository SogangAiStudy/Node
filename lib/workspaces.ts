import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { buildTeamRequestFilters } from "@/lib/utils/requests";

export interface WorkspaceSummary {
  orgId: string;
  name: string;
  status: string;
  hasUnreadInbox: boolean;
  unreadCount: number;
}

interface SessionUserLike {
  id: string;
  email?: string | null;
}

async function resolveWorkspaceUser(sessionUser: SessionUserLike) {
  let dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, email: true },
  });

  if (!dbUser && sessionUser.email) {
    dbUser = await prisma.user.findUnique({
      where: { email: sessionUser.email },
      select: { id: true, email: true },
    });
  }

  return dbUser;
}

async function getUnreadInboxCount(orgId: string, userId: string): Promise<number> {
  const userTeams = await prisma.teamMember.findMany({
    where: {
      orgId,
      userId,
    },
    select: {
      teamId: true,
      team: {
        select: {
          name: true,
        },
      },
    },
  });

  const teamNames = userTeams.flatMap((tm) => (tm.team?.name ? [tm.team.name] : []));
  const userTeamIds = userTeams.flatMap((tm) => (tm.teamId ? [tm.teamId] : []));
  const requestTargets: Prisma.RequestWhereInput[] = [{ toUserId: userId }];
  const notificationTargets: Prisma.NotificationWhereInput[] = [{ userId, targetType: "USER" }];

  requestTargets.push(...buildTeamRequestFilters(userTeamIds, teamNames));

  if (userTeamIds.length > 0) {
    notificationTargets.push({
      targetType: "TEAM" as const,
      targetTeamId: { in: userTeamIds },
    });
  }

  const [unreadRequests, unreadNotifications, unreadInvites] = await Promise.all([
    prisma.request.count({
      where: {
        orgId,
        OR: requestTargets,
        status: {
          not: "CLOSED",
        },
      },
    }),
    prisma.notification.count({
      where: {
        orgId,
        OR: notificationTargets,
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

export async function getCurrentUserWorkspaces(): Promise<WorkspaceSummary[]> {
  const sessionUser = await requireAuth();
  const dbUser = await resolveWorkspaceUser(sessionUser);

  if (!dbUser) {
    throw new Error("Unauthorized - User not found in database");
  }

  const orgMemberships = await prisma.orgMember.findMany({
    where: {
      userId: dbUser.id,
      status: {
        in: ["ACTIVE", "PENDING_TEAM_ASSIGNMENT", "PENDING_APPROVAL"],
      },
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

  return Promise.all(
    orgMemberships.map(async (membership) => {
      let unreadCount = 0;
      if (["ACTIVE", "PENDING_TEAM_ASSIGNMENT"].includes(membership.status)) {
        unreadCount = await getUnreadInboxCount(membership.orgId, dbUser.id);
      }

      return {
        orgId: membership.orgId,
        name: membership.organization.name,
        status: membership.status,
        hasUnreadInbox: unreadCount > 0,
        unreadCount,
      };
    })
  );
}
