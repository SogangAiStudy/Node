import { prisma } from "@/lib/db/prisma";
import { NotificationType, NotificationTargetType } from "@prisma/client";

export async function createNotification({
    userId,
    orgId,
    type,
    title,
    message,
    entityId,
    targetType = "USER",
    targetTeamId,
    dedupeKey,
}: {
    userId?: string;
    orgId: string;
    type: NotificationType;
    title: string;
    message?: string;
    entityId?: string;
    targetType?: NotificationTargetType;
    targetTeamId?: string;
    dedupeKey?: string;
}) {
    try {
        return await prisma.notification.create({
            data: {
                userId,
                orgId,
                type,
                title,
                message,
                entityId,
                targetType,
                targetTeamId,
                dedupeKey,
            },
        });
    } catch (error: any) {
        // If it's a unique constraint violation for dedupeKey, just return null or existing
        if (error.code === 'P2002') {
            console.log(`Notification deduplicated: ${dedupeKey}`);
            return null;
        }
        throw error;
    }
}

/**
 * Trigger "Unblocked" notifications for nodes that depend on the completed node
 */
export async function triggerUnblockedNotifications(completedNodeId: string, orgId: string) {
    // 1. Find all edges where someone else's node DEPENDS_ON this node
    const dependentEdges = await prisma.edge.findMany({
        where: {
            toNodeId: completedNodeId,
            relation: "DEPENDS_ON",
        },
        include: {
            fromNode: {
                include: {
                    nodeOwners: true,
                },
            },
        },
    });

    for (const edge of dependentEdges) {
        const dependentNode = edge.fromNode;

        // 2. Check if this dependent node is now fully unblocked
        const otherDependencies = await prisma.edge.findMany({
            where: {
                fromNodeId: dependentNode.id,
                relation: "DEPENDS_ON",
                toNodeId: { not: completedNodeId },
            },
            include: {
                toNode: true,
            },
        });

        // Current status must be TODO to receive an unblocked notification (transition into actionable state)
        const isFullyUnblocked = otherDependencies.every(dep => dep.toNode.manualStatus === "DONE");

        if (isFullyUnblocked && dependentNode.manualStatus === "TODO") {
            // 3. Notify owners
            const owners = dependentNode.nodeOwners.length > 0
                ? dependentNode.nodeOwners.map(o => o.userId)
                : dependentNode.ownerId ? [dependentNode.ownerId] : [];

            for (const userId of owners) {
                await createNotification({
                    userId,
                    orgId,
                    type: "NODE_UNBLOCKED",
                    title: "Node Unblocked",
                    message: `All dependencies for "${dependentNode.title}" are now complete. You can start working on it.`,
                    entityId: dependentNode.id,
                    dedupeKey: `UNBLOCKED:${dependentNode.id}:${userId}`, // Per-user dedupe
                });
            }
        }
    }
}

/**
 * Trigger notifications when a node is assigned to users or teams
 */
export async function triggerNodeAssignmentNotifications({
    nodeId,
    orgId,
    title,
    ownerIds = [],
    teamIds = [],
    isNew = false,
}: {
    nodeId: string;
    orgId: string;
    title: string;
    ownerIds?: string[];
    teamIds?: string[];
    isNew?: boolean;
}) {
    // Notify users
    for (const userId of ownerIds) {
        await createNotification({
            userId,
            orgId,
            type: "NODE_ASSIGNED",
            title: isNew ? "New Node Assigned" : "Assigned to Node",
            message: isNew
                ? `You have been assigned to the node "${title}".`
                : `You were added as an owner of "${title}".`,
            entityId: nodeId,
            dedupeKey: `NODE_ASSIGN:${nodeId}:${userId}`,
        });
    }

    // Notify teams
    for (const teamId of teamIds) {
        const team = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
        await createNotification({
            orgId,
            type: "NODE_ASSIGNED",
            targetType: "TEAM",
            targetTeamId: teamId,
            title: isNew ? "Team Node Assigned" : "Team Added to Node",
            message: isNew
                ? `Your team "${team?.name || "Unknown"}" has been assigned to "${title}".`
                : `Your team "${team?.name || "Unknown"}" was added to "${title}".`,
            entityId: nodeId,
            dedupeKey: `NODE_TEAM_ASSIGN:${nodeId}:${teamId}`,
        });
    }
}

/**
 * Trigger notifications when a team is assigned to a project
 */
export async function triggerProjectAssignmentNotifications({
    projectId,
    projectName,
    orgId,
    teamIds,
}: {
    projectId: string;
    projectName: string;
    orgId: string;
    teamIds: string[];
}) {
    for (const teamId of teamIds) {
        const team = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
        await createNotification({
            orgId,
            type: "PROJECT_ASSIGNED",
            targetType: "TEAM",
            targetTeamId: teamId,
            title: "Project Assigned",
            message: `Your team "${team?.name || "Unknown"}" has been assigned to the project "${projectName}".`,
            entityId: projectId,
            dedupeKey: `PROJECT_TEAM_ASSIGN:${projectId}:${teamId}`,
        });
    }
}
