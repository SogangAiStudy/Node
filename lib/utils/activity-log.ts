import { prisma } from "@/lib/db/prisma";

export type ActivityAction =
  | "CREATE_NODE"
  | "UPDATE_NODE"
  | "DELETE_NODE"
  | "CREATE_EDGE"
  | "DELETE_EDGE"
  | "CREATE_REQUEST"
  | "RESPOND_REQUEST"
  | "CLAIM_REQUEST"
  | "APPROVE_REQUEST"
  | "CLOSE_REQUEST"
  | "CREATE_PROJECT"
  | "ADD_PROJECT_MEMBER";

export type EntityType = "NODE" | "EDGE" | "REQUEST" | "PROJECT" | "PROJECT_MEMBER";

/**
 * Create an activity log entry for audit trail
 */
export async function createActivityLog({
  projectId,
  userId,
  action,
  entityType,
  entityId,
  details,
}: {
  projectId: string;
  userId: string;
  action: ActivityAction;
  entityType: EntityType;
  entityId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await prisma.activityLog.create({
    data: {
      projectId,
      userId,
      action,
      entityType,
      entityId,
      details: details || {},
    },
  });
}

/**
 * Get activity logs for a project
 */
export async function getActivityLogs(
  projectId: string,
  limit: number = 50
): Promise<
  Array<{
    id: string;
    projectId: string;
    userId: string;
    userName: string;
    action: string;
    entityType: string;
    entityId: string;
    details: Record<string, unknown> | null;
    createdAt: Date;
  }>
> {
  const logs = await prisma.activityLog.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  return logs.map((log) => ({
    id: log.id,
    projectId: log.projectId,
    userId: log.userId,
    userName: log.user.name || "Unknown User",
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    details: log.details as Record<string, unknown> | null,
    createdAt: log.createdAt,
  }));
}
