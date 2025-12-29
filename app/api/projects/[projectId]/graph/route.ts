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

    // Fetch nodes, edges, and requests
    const [nodes, edges, requests] = await Promise.all([
      prisma.node.findMany({
        where: { projectId },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
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

    // Compute statuses for all nodes
    const statusMap = computeAllNodeStatuses(nodes, edges, requests);

    // Transform to DTOs
    const nodeDTOs: NodeDTO[] = nodes.map((node) => ({
      id: node.id,
      projectId: node.projectId,
      title: node.title,
      description: node.description,
      type: node.type,
      manualStatus: node.manualStatus,
      computedStatus: statusMap.get(node.id)!,
      ownerId: node.ownerId,
      ownerName: node.owner?.name || null,
      team: node.team,
      priority: node.priority,
      dueAt: node.dueAt?.toISOString() || null,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
    }));

    const edgeDTOs: EdgeDTO[] = edges.map((edge) => ({
      id: edge.id,
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
