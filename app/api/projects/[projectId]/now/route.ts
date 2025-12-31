import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireProjectMembership } from "@/lib/utils/auth";
import {
  computeAllNodeStatuses,
  getMyTodos,
  getMyWaiting,
  getImBlocking,
} from "@/lib/status/compute-status";
import { NodeDTO, NowData } from "@/types";

// GET /api/projects/[projectId]/now - Get now view data (My Todos, My Waiting, I'm Blocking)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;

    await requireProjectMembership(projectId, user.id);

    // Fetch all nodes, edges, and requests
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
          team: {
            select: {
              id: true,
              name: true,
            },
          },
          nodeTeams: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          nodeOwners: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.edge.findMany({
        where: { projectId },
      }),
      prisma.request.findMany({
        where: { projectId },
      }),
    ]);

    // Compute statuses
    const statusMap = computeAllNodeStatuses(nodes, edges, requests);

    // Get my todos, waiting, and blocking
    const myTodosNodes = getMyTodos(user.id, nodes, statusMap);
    const myWaitingNodes = getMyWaiting(user.id, nodes, statusMap);
    const imBlockingData = getImBlocking(user.id, nodes, edges);

    // Transform to DTOs
    const toNodeDTO = (node: any): NodeDTO => ({
      id: node.id,
      orgId: node.orgId,
      projectId: node.projectId,
      teamId: node.teamId,
      teamName: node.team?.name || null,
      title: node.title,
      description: node.description,
      type: node.type,
      manualStatus: node.manualStatus,
      computedStatus: statusMap.get(node.id)!,
      ownerId: node.ownerId,
      ownerName: node.owner?.name || null,
      teams: node.nodeTeams?.map((nt: any) => ({ id: nt.team.id, name: nt.team.name })) || [],
      owners: node.nodeOwners?.map((no: any) => ({ id: no.user.id, name: no.user.name })) || [],
      priority: node.priority,
      dueAt: node.dueAt?.toISOString() || null,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
      positionX: node.positionX ?? null,
      positionY: node.positionY ?? null,
    });

    const myTodos = myTodosNodes.map(toNodeDTO);
    const myWaiting = myWaitingNodes.map(toNodeDTO);
    const imBlocking = imBlockingData.map(({ blockedNode, waitingOnMyNode }) => ({
      blockedNode: toNodeDTO(blockedNode),
      waitingOnMyNode: toNodeDTO(waitingOnMyNode),
    }));

    const nowData: NowData = {
      myTodos,
      myWaiting,
      imBlocking,
    };

    return NextResponse.json(nowData);
  } catch (error) {
    console.error("GET /api/projects/[projectId]/now error:", error);

    if (error instanceof Error && error.message === "Not a member of this project") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to fetch now data" }, { status: 500 });
  }
}
