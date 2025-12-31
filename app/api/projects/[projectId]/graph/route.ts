import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireProjectMembership } from "@/lib/utils/auth";
import { computeAllNodeStatuses } from "@/lib/status/compute-status";
import { NodeDTO, EdgeDTO } from "@/types";

// GET /api/projects/[projectId]/graph - Get all nodes and edges with computed status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;

    await requireProjectMembership(projectId, user.id);

    // 1. Fetch base nodes, edges, and requests without heavy inclusions first
    const [baseNodes, edges, requests] = await Promise.all([
      prisma.node.findMany({
        where: { projectId },
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
        edges: edges.map((edge: any) => ({
          id: edge.id,
          orgId: edge.orgId,
          projectId: edge.projectId,
          fromNodeId: edge.fromNodeId,
          toNodeId: edge.toNodeId,
          relation: edge.relation,
          createdAt: edge.createdAt.toISOString(),
        })),
      });
    }

    // 2. Collect unique IDs for relations to avoid "IN (NULL)" queries
    const ownerIds = Array.from(new Set(baseNodes.map((n: any) => n.ownerId).filter(Boolean))) as string[];
    const teamIds = Array.from(new Set(baseNodes.map((n: any) => n.teamId).filter(Boolean))) as string[];
    const nodeIds = baseNodes.map((n: any) => n.id);

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
    const ownerMap = new Map(owners.map((u: any) => [u.id, u.name]));
    const teamMap = new Map(teams.map((t: any) => [t.id, t.name]));
    const nodeOwnersMap = new Map<string, Array<{ id: string; name: string }>>();
    const nodeTeamsMap = new Map<string, Array<{ id: string; name: string }>>();

    nodeOwners.forEach((no: any) => {
      const list = nodeOwnersMap.get(no.nodeId) || [];
      list.push({ id: no.user.id, name: no.user.name || "Unknown" });
      nodeOwnersMap.set(no.nodeId, list);
    });

    nodeTeams.forEach((nt: any) => {
      const list = nodeTeamsMap.get(nt.nodeId) || [];
      list.push({ id: nt.team.id, name: nt.team.name });
      nodeTeamsMap.set(nt.nodeId, list);
    });

    // Compute statuses for all nodes
    const statusMap = computeAllNodeStatuses(baseNodes, edges, requests);

    // 4. Transform to DTOs using maps
    const nodeDTOs: NodeDTO[] = baseNodes.map((node: any) => ({
      id: node.id,
      orgId: node.orgId,
      projectId: node.projectId,
      teamId: node.teamId,
      teamName: node.teamId ? teamMap.get(node.teamId) || null : null,
      title: node.title,
      description: node.description,
      type: node.type,
      manualStatus: node.manualStatus,
      computedStatus: statusMap.get(node.id)!,
      ownerId: node.ownerId,
      ownerName: node.ownerId ? ownerMap.get(node.ownerId) || null : null,
      teams: nodeTeamsMap.get(node.id) || [],
      owners: nodeOwnersMap.get(node.id) || [],
      priority: node.priority,
      dueAt: node.dueAt?.toISOString() || null,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
    }));

    const edgeDTOs: EdgeDTO[] = edges.map((edge: any) => ({
      id: edge.id,
      orgId: edge.orgId,
      projectId: edge.projectId,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      relation: edge.relation,
      createdAt: edge.createdAt.toISOString(),
    }));

    return NextResponse.json({
      nodes: nodeDTOs,
      edges: edgeDTOs,
    });
  } catch (error) {
    console.error("GET /api/projects/[projectId]/graph error:", error);

    if (error instanceof Error && error.message === "Not a member of this project") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to fetch graph data" }, { status: 500 });
  }
}
