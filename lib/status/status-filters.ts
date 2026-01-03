
import { Node, Edge, Request } from "@prisma/client";
import { ComputedStatus, ManualStatus, NodeDTO } from "@/types";
import { computeAllNodeStatuses } from "./compute-status";

// Helper to check if a user is an owner
function isOwner(userId: string, node: any) {
    return node.ownerId === userId || node.nodeOwners?.some((no: any) => no.userId === userId);
}

/**
 * Filter: Action Center - My Actions
 * Criteria: 
 * - Owned by user
 * - Manual Status is TODO or DOING
 * - Computed Status is NOT BLOCKED and NOT WAITING
 */
export function getMyActionsForActionCenter(
    userId: string,
    nodes: any[],
    statusMap: Map<string, ComputedStatus>
): any[] {
    return nodes.filter((node) => {
        if (!isOwner(userId, node)) return false;

        const computedStatus = statusMap.get(node.id);
        if (!computedStatus) return false;

        // Must be actionable
        if (computedStatus === "BLOCKED" || computedStatus === "WAITING") return false;

        return node.manualStatus === ManualStatus.TODO || node.manualStatus === ManualStatus.DOING;
    });
}

/**
 * Filter: Action Center - My Waiting
 * Criteria:
 * - Owned by user
 * - Computed Status is WAITING (explicitly waiting on external input) or BLOCKED (cannot proceed)
 * NOTE: The original requirement grouped these. 
 * If we strictly follow "Waiting" section vs "Blocking" section:
 * "Waiting" = Items I own that are waiting/blocked.
 * "Blocking" = Items I own that are blocking OTHERS.
 */
export function getMyWaitingForActionCenter(
    userId: string,
    nodes: any[],
    statusMap: Map<string, ComputedStatus>
): any[] {
    return nodes.filter((node) => {
        if (!isOwner(userId, node)) return false;

        const computedStatus = statusMap.get(node.id);
        return computedStatus === "BLOCKED" || computedStatus === "WAITING";
    });
}

/**
 * Filter: Action Center - I am Blocking
 * Criteria:
 * - Node owned by ME (incomplete)
 * - Is a dependency for a node owned by SOMEONE ELSE
 * - The dependent node is actually BLOCKED by this relationship
 */
export function getImBlockingForActionCenter(
    userId: string,
    nodes: any[],
    edges: Edge[]
): Array<{ blockedNode: any; waitingOnMyNode: any }> {
    const result: Array<{ blockedNode: any; waitingOnMyNode: any }> = [];

    // 1. Find my incomplete nodes
    const myIncompleteNodes = nodes.filter((node) => {
        return isOwner(userId, node) && node.manualStatus !== ManualStatus.DONE;
    });

    for (const myNode of myIncompleteNodes) {
        // 2. Find internal edges where myNode is the source/precursor (DEPENDS_ON means From -> To? No, DEPENDS_ON usually means A depends on B. 
        // Let's check schema/usage.
        // In computeNodeStatus: 
        // const dependsOnEdges = allEdges.filter(edge => edge.fromNodeId === node.id && edge.relation === EdgeRelation.DEPENDS_ON);
        // So 'from' depends on 'to'.
        // If I am blocking someone, THEY depend on ME.
        // So 'from' is them, 'to' is me.

        const dependentEdges = edges.filter(
            (edge) => edge.toNodeId === myNode.id && edge.relation === "DEPENDS_ON"
        );

        for (const edge of dependentEdges) {
            const blockedNode = nodes.find((n) => n.id === edge.fromNodeId);

            if (blockedNode) {
                // Check ownership of the blocked node
                const isBlockedNodeOwnedByMe = isOwner(userId, blockedNode);

                // Only count if blocking SOMEONE ELSE (or unassigned, but meant for team?)
                // Spec says "Blocking" items answers "What is creating a bottleneck?".
                // Usually implies blocking others. Blocking myself is just "sequential work".
                // Let's exclude valid self-blocks to reduce noise, or include them if critical.
                // Directive: "Blocking: Nodes enabling other people's work". -> "Other people".

                const hasOwner = blockedNode.ownerId !== null || (blockedNode.nodeOwners && blockedNode.nodeOwners.length > 0);

                if (!isBlockedNodeOwnedByMe && hasOwner) {
                    result.push({
                        blockedNode,
                        waitingOnMyNode: myNode,
                    });
                }
            }
        }
    }

    return result;
}
