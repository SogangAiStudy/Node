
import { EdgeRelation, ManualStatus, RequestStatus, NodeType } from "@prisma/client";

// Minimal interface for the node data needed to check status
export interface NodeWithRelations {
    id: string;
    manualStatus: ManualStatus;
    edgesFrom: Array<{
        relation: EdgeRelation;
        toNode: {
            manualStatus: ManualStatus;
        };
    }>;
    linkedRequests: Array<{
        id: string; // Added ID
        status: RequestStatus;
        question?: string;
        linkedNodeId: string; // To differentiate if needed, though usually filtered by query
    }>;
}

/**
 * STRICT Logic for checking if a node is BLOCKED.
 * 
 * A node is BLOCKED if:
 * 1. It has incoming 'DEPENDS_ON' edges where the dependency is NOT DONE.
 * 2. It has incoming 'APPROVAL_BY' edges where the approver has NOT DONE the task (conceptually).
 * 3. It has open requests linked to it (waiting for answers).
 * 
 * @param node The node with its edges and requests loaded
 * @returns boolean
 */
export function isNodeBlocked(node: NodeWithRelations): boolean {
    // If the node itself is already marked DONE, it's not blocked conceptually (it's finished).
    if (node.manualStatus === "DONE") return false;

    // 1. Check Dependencies (Incoming edges where relation is DEPENDS_ON)
    // Note: in edge definition, "fromNode reduces to toNode". 
    // Let's verify standard: "From A depends on B".
    // If we are looking at Node A, we look at edges where A is 'fromNode' and relation is 'DEPENDS_ON'.
    // Wait, let's verify schema direction.
    // Edge: fromNode -> toNode.
    // RELATION: DEPENDS_ON.
    // Usually means: "fromNode DEPENDS_ON toNode".
    // So if I am 'fromNode', I depend on 'toNode'.
    // If 'toNode' is NOT DONE, I am blocked.

    const incompleteDependencies = node.edgesFrom.some(edge => {
        if (edge.relation === EdgeRelation.DEPENDS_ON) {
            return edge.toNode.manualStatus !== "DONE";
        }
        return false;
    });

    if (incompleteDependencies) return true;

    // 2. Check Approvals
    // If I need approval by someone, and that approval task/node isn't done.
    // Same logic: "fromNode APPROVAL_BY toNode".
    const pendingApprovals = node.edgesFrom.some(edge => {
        if (edge.relation === EdgeRelation.APPROVAL_BY) {
            // If the "approver" task is not done, we are blocked?
            // Or strictly if "APPROVAL_BY" exists, we might block until it's done.
            return edge.toNode.manualStatus !== "DONE";
        }
        return false;
    });

    if (pendingApprovals) return true;

    // 3. Check Requests (Blockers / Info Needed)
    // If there are OPEN requests linked to this node.
    // Especially if they are "blocking".
    // Schema has RequestStatus: OPEN, RESPONDED, APPROVED, CLOSED.
    // We consider OPEN and RESPONDED as "active" requests that might block.
    // RESPONDED might not block, but for safety, if you asked something and got a draft, you need to approve it to close it.
    const hasOpenRequests = node.linkedRequests.some(req =>
        req.status === RequestStatus.OPEN || req.status === RequestStatus.RESPONDED
    );

    if (hasOpenRequests) return true;

    return false;
}

/**
 * Helper to get specific blocking reasons (for AI context)
 */
export function getBlockingDetails(node: NodeWithRelations) {
    const details: Array<{
        type: "DEPENDENCY" | "APPROVAL" | "REQUEST";
        nodeId?: NodeWithRelations["edgesFrom"][0]["toNode"]; // Simplified for utility
        requestId?: string;
        status?: RequestStatus;
    }> = [];

    // Dependencies
    node.edgesFrom.forEach(edge => {
        if (edge.relation === EdgeRelation.DEPENDS_ON && edge.toNode.manualStatus !== "DONE") {
            details.push({ type: "DEPENDENCY", nodeId: edge.toNode });
        }
        if (edge.relation === EdgeRelation.APPROVAL_BY && edge.toNode.manualStatus !== "DONE") {
            details.push({ type: "APPROVAL", nodeId: edge.toNode });
        }
    });

    // Requests
    node.linkedRequests.forEach(req => {
        if (req.status === RequestStatus.OPEN || req.status === RequestStatus.RESPONDED) {
            details.push({ type: "REQUEST", requestId: req.id, status: req.status });
        }
    });

    return details;
}
