import { Node, Edge, Request, ManualStatus, EdgeRelation, RequestStatus } from "@prisma/client";
import { ComputedStatus } from "@/types";

/**
 * Compute the status of a node based on its dependencies and requests
 * Priority: BLOCKED > WAITING > DONE > DOING > TODO
 *
 * BLOCKED: Node has DEPENDS_ON edge to any non-DONE node
 * WAITING: Node has OPEN/RESPONDED request OR APPROVAL_BY edge without APPROVED request
 * Otherwise: Return node's manualStatus
 */
export function computeNodeStatus(
  node: Node,
  allNodes: Node[],
  allEdges: Edge[],
  allRequests: Request[]
): ComputedStatus {
  // Check for BLOCKED status
  // Node is BLOCKED if it has DEPENDS_ON edge to any non-DONE node
  const dependsOnEdges = allEdges.filter(
    (edge) => edge.fromNodeId === node.id && edge.relation === EdgeRelation.DEPENDS_ON
  );

  for (const edge of dependsOnEdges) {
    const dependencyNode = allNodes.find((n) => n.id === edge.toNodeId);
    if (dependencyNode && dependencyNode.manualStatus !== ManualStatus.DONE) {
      return "BLOCKED";
    }
  }

  // Check for WAITING status
  // 1. Node has any OPEN or RESPONDED request linked to it
  const hasActiveRequest = allRequests.some(
    (req) =>
      req.linkedNodeId === node.id &&
      (req.status === RequestStatus.OPEN || req.status === RequestStatus.RESPONDED)
  );

  if (hasActiveRequest) {
    return "WAITING";
  }

  // 2. Node has APPROVAL_BY edge and no corresponding APPROVED request
  const approvalByEdges = allEdges.filter(
    (edge) => edge.fromNodeId === node.id && edge.relation === EdgeRelation.APPROVAL_BY
  );

  if (approvalByEdges.length > 0) {
    const hasApprovedRequest = allRequests.some(
      (req) => req.linkedNodeId === node.id && req.status === RequestStatus.APPROVED
    );

    if (!hasApprovedRequest) {
      return "WAITING";
    }
  }

  // Otherwise, return the manual status as computed status
  return node.manualStatus as ComputedStatus;
}

/**
 * Compute statuses for all nodes in a project
 */
export function computeAllNodeStatuses(
  nodes: Node[],
  edges: Edge[],
  requests: Request[]
): Map<string, ComputedStatus> {
  const statusMap = new Map<string, ComputedStatus>();

  for (const node of nodes) {
    const status = computeNodeStatus(node, nodes, edges, requests);
    statusMap.set(node.id, status);
  }

  return statusMap;
}

/**
 * Helper to get nodes for "My Todos" - nodes I own that are actionable
 * Actionable = computedStatus NOT IN (BLOCKED, WAITING) AND manualStatus IN (TODO, DOING)
 */
export function getMyTodos(
  userId: string,
  nodes: Node[],
  statusMap: Map<string, ComputedStatus>
): Node[] {
  return nodes.filter((node: any) => {
    const isOwner = node.ownerId === userId ||
      node.nodeOwners?.some((no: any) => no.userId === userId);

    if (!isOwner) return false;

    const computedStatus = statusMap.get(node.id);
    if (!computedStatus) return false;

    // Exclude BLOCKED and WAITING
    if (computedStatus === "BLOCKED" || computedStatus === "WAITING") return false;

    // Only include TODO and DOING (actionable items)
    return node.manualStatus === ManualStatus.TODO || node.manualStatus === ManualStatus.DOING;
  });
}

/**
 * Helper to get nodes for "My Waiting" - nodes I own that are blocked or waiting
 */
export function getMyWaiting(
  userId: string,
  nodes: Node[],
  statusMap: Map<string, ComputedStatus>
): Node[] {
  return nodes.filter((node: any) => {
    const isOwner = node.ownerId === userId ||
      node.nodeOwners?.some((no: any) => no.userId === userId);

    if (!isOwner) return false;

    const computedStatus = statusMap.get(node.id);
    return computedStatus === "BLOCKED" || computedStatus === "WAITING";
  });
}

/**
 * Helper to get nodes for "I'm Blocking" - other users' nodes that are blocked by my nodes
 * Logic: Find nodes where:
 * 1. Another user owns node A
 * 2. A DEPENDS_ON my node B
 * 3. B is not DONE
 */
export function getImBlocking(
  userId: string,
  nodes: Node[],
  edges: Edge[]
): Array<{ blockedNode: Node; waitingOnMyNode: Node }> {
  const result: Array<{ blockedNode: Node; waitingOnMyNode: Node }> = [];

  // Find all my nodes that are not DONE
  const myIncompleteNodes = nodes.filter((node: any) => {
    const isOwner = node.ownerId === userId ||
      node.nodeOwners?.some((no: any) => no.userId === userId);
    return isOwner && node.manualStatus !== ManualStatus.DONE;
  });

  for (const myNode of myIncompleteNodes) {
    // Find all edges where someone else's node DEPENDS_ON this node
    const dependentEdges = edges.filter(
      (edge) => edge.toNodeId === myNode.id && edge.relation === EdgeRelation.DEPENDS_ON
    );

    for (const edge of dependentEdges) {
      const blockedNode: any = nodes.find((n) => n.id === edge.fromNodeId);

      if (blockedNode) {
        // Only include if the blocked node is NOT owned by me (neither primary nor multi)
        const isBlockedNodeOwnedByMe = blockedNode.ownerId === userId ||
          blockedNode.nodeOwners?.some((no: any) => no.userId === userId);

        // Also ensure it HAS an owner or owners (not unassigned)
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
