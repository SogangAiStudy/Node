import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectView } from "@/lib/utils/permissions";
import { authOrPermissionErrorResponse } from "@/lib/utils/api-error-responses";
import { computeAllNodeStatuses } from "@/lib/status/compute-status";
import type { Edge, Prisma } from "@prisma/client";
import type { ComputedStatus, NodeDTO, EdgeDTO } from "@/types";

type GraphNode = Prisma.NodeGetPayload<{
  include: {
    _count: {
      select: {
        comments: true;
        attachments: true;
        childNodes: true;
      };
    };
  };
}>;

function toEdgeDTO(edge: Edge): EdgeDTO {
  return {
    id: edge.id,
    orgId: edge.orgId,
    projectId: edge.projectId,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    relation: edge.relation,
    createdAt: edge.createdAt.toISOString(),
  };
}

// GET /api/projects/[projectId]/graph - Get all nodes and edges with computed status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;

    await requireProjectView(projectId, user.id);

    // 1. Fetch base nodes, edges, and requests without heavy inclusions first
    const [baseNodes, edges, requests] = await Promise.all([
      prisma.node.findMany({
        where: { projectId },
        include: {
          _count: {
            select: {
              comments: true,
              attachments: true,
              childNodes: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.edge.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.request.findMany({
        where: { projectId },
      }),
    ]);

    if (baseNodes.length === 0) {
      return NextResponse.json({
        nodes: [],
        edges: edges.map(toEdgeDTO),
      });
    }

    // 2. Collect unique IDs for relations to avoid "IN (NULL)" queries
    const ownerIds = Array.from(new Set(baseNodes.map((node) => node.ownerId).filter((id): id is string => Boolean(id))));
    const teamIds = Array.from(new Set(baseNodes.map((node) => node.teamId).filter((id): id is string => Boolean(id))));
    const nodeIds = baseNodes.map((node) => node.id);

    // 3. Fetch relations conditionally
    const [owners, teams, nodeOwners, nodeTeams] = await Promise.all([
      ownerIds.length > 0
        ? prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true },
        })
        : Promise.resolve([]),
      teamIds.length > 0
        ? prisma.team.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, name: true },
        })
        : Promise.resolve([]),
      nodeIds.length > 0
        ? prisma.nodeOwner.findMany({
          where: { nodeId: { in: nodeIds } },
          include: { user: { select: { id: true, name: true } } },
        })
        : Promise.resolve([]),
      nodeIds.length > 0
        ? prisma.nodeTeam.findMany({
          where: { nodeId: { in: nodeIds } },
          include: { team: { select: { id: true, name: true } } },
        })
        : Promise.resolve([]),
    ]);

    // Create lookup maps for performance
    const ownerMap = new Map(owners.map((user) => [user.id, user.name]));
    const teamMap = new Map(teams.map((team) => [team.id, team.name]));
    const nodeOwnersMap = new Map<string, Array<{ id: string; name: string }>>();
    const nodeTeamsMap = new Map<string, Array<{ id: string; name: string }>>();

    nodeOwners.forEach((nodeOwner) => {
      const { nodeId, user: owner } = nodeOwner;
      const list = nodeOwnersMap.get(nodeId) || [];
      list.push({ id: owner.id, name: owner.name || "Unknown" });
      nodeOwnersMap.set(nodeId, list);
    });

    nodeTeams.forEach((nodeTeam) => {
      const { nodeId, team } = nodeTeam;
      const list = nodeTeamsMap.get(nodeId) || [];
      list.push({ id: team.id, name: team.name });
      nodeTeamsMap.set(nodeId, list);
    });

    // Compute statuses for all nodes
    const statusMap = computeAllNodeStatuses(baseNodes, edges, requests);

    // 4. Transform to DTOs using maps
    const nodeDTOs: NodeDTO[] = baseNodes.map((node: GraphNode) => {
      const computedStatus = statusMap.get(node.id) || (node.manualStatus as ComputedStatus) || "TODO";

      // Calculate blocking count
      // Find edges where this node is the 'to' (dependency) and the 'from' (dependent) is BLOCKED
      // relation DEPENDS_ON: from depends on to.
      let blocksCount = 0;
      if (computedStatus !== 'DONE') {
        const dependentEdges = edges.filter((edge) => edge.toNodeId === node.id && edge.relation === 'DEPENDS_ON');
        blocksCount = dependentEdges.filter((edge) => {
          const dependentStatus = statusMap.get(edge.fromNodeId);
          return dependentStatus === 'BLOCKED';
        }).length;
      }

      // Calculate waiting reason
      let waitingReason = undefined;
      if (computedStatus === 'WAITING' || computedStatus === 'BLOCKED') {
        // Check requests
        const nodeRequests = requests.filter((request) => request.linkedNodeId === node.id && (request.status === 'OPEN' || request.status === 'RESPONDED'));
        if (nodeRequests.length > 0) {
          waitingReason = "Waiting for response";
        } else {
          // Check approval edges
          const approvalEdges = edges.filter((edge) => edge.fromNodeId === node.id && edge.relation === 'APPROVAL_BY');
          if (approvalEdges.length > 0) {
            waitingReason = "Waiting for approval";
          } else if (computedStatus === 'BLOCKED') {
            const blockingEdges = edges.filter((edge) => edge.fromNodeId === node.id && edge.relation === 'DEPENDS_ON');
            if (blockingEdges.length > 0) {
              waitingReason = `Blocked by ${blockingEdges.length} task${blockingEdges.length > 1 ? 's' : ''}`;
            }
          }
        }
      }

      return {
        id: node.id,
        orgId: node.orgId,
        projectId: node.projectId,
        parentNodeId: node.parentNodeId,
        teamId: node.teamId,
        teamName: node.teamId ? teamMap.get(node.teamId) || null : null,
        title: node.title,
        description: node.description,
        type: node.type,
        manualStatus: node.manualStatus,
        computedStatus,
        blocksCount,
        waitingReason,
        ownerId: node.ownerId,
        ownerName: node.ownerId ? ownerMap.get(node.ownerId) || null : null,
        teams: nodeTeamsMap.get(node.id) || [],
        owners: nodeOwnersMap.get(node.id) || [],
        priority: node.priority,
        dueAt: node.dueAt?.toISOString() || null,
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString(),
        commentCount: node._count?.comments || 0,
        attachmentCount: node._count?.attachments || 0,
        childCount: node._count?.childNodes || 0,
        positionX: node.positionX,
        positionY: node.positionY,
        phase: node.phase || null,
      };
    });

    const edgeDTOs: EdgeDTO[] = edges.map(toEdgeDTO);

    return NextResponse.json({
      nodes: nodeDTOs,
      edges: edgeDTOs,
    });
  } catch (error) {
    const authResponse = authOrPermissionErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("GET /api/projects/[projectId]/graph error:", error);
    return NextResponse.json({ error: "Failed to fetch graph data" }, { status: 500 });
  }
}
