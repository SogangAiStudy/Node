import { prisma } from "@/lib/db/prisma";

export type ActivityAction =
  | "CREATE_NODE"
  | "UPDATE_NODE"
  | "DELETE_NODE"
  | "CREATE_EDGE"
  | "UPDATE_EDGE"
  | "DELETE_EDGE"
  | "CREATE_REQUEST"
  | "RESPOND_REQUEST"
  | "CLAIM_REQUEST"
  | "APPROVE_REQUEST"
  | "CLOSE_REQUEST"
  | "CREATE_PROJECT"
  | "ADD_PROJECT_MEMBER"
  | "UPDATE_PROJECT_MEMBER";

export type EntityType = "NODE" | "EDGE" | "REQUEST" | "PROJECT" | "PROJECT_MEMBER";

/**
 * Create an activity log entry for audit trail
 */
export async function createActivityLog({
  orgId,
  projectId,
  userId,
  action,
  entityType,
  entityId,
  details,
}: {
  orgId?: string;
  projectId: string;
  userId: string;
  action: ActivityAction;
  entityType: EntityType;
  entityId: string;
  details?: Record<string, unknown>;
}, tx?: any): Promise<void> {
  const db = tx || prisma;

  // Get orgId from project if not provided
  let finalOrgId = orgId;
  if (!finalOrgId) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { orgId: true },
    });
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    finalOrgId = project.orgId;
  }

  await db.activityLog.create({
    data: {
      orgId: finalOrgId,
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

  return logs.map((log: any) => ({
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
