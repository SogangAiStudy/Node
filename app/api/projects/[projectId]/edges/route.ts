import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectView } from "@/lib/utils/permissions";
import { createActivityLog } from "@/lib/utils/activity-log";
import { wouldCreateCycle, findCyclePath } from "@/lib/status/cycle-detection";
import { z } from "zod";
import { EdgeRelation } from "@/types";

const CreateEdgeSchema = z.object({
  fromNodeId: z.string(),
  toNodeId: z.string(),
  relation: z.nativeEnum(EdgeRelation),
});

// POST /api/projects/[projectId]/edges - Create new edge with cycle detection
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;

    await requireProjectView(projectId, user.id);

    const body = await request.json();
    const validated = CreateEdgeSchema.parse(body);

    // Verify both nodes exist and belong to this project
    const [fromNode, toNode] = await Promise.all([
      prisma.node.findUnique({ where: { id: validated.fromNodeId } }),
      prisma.node.findUnique({ where: { id: validated.toNodeId } }),
    ]);

    if (!fromNode || fromNode.projectId !== projectId) {
      return NextResponse.json({ error: "From node not found in this project" }, { status: 404 });
    }

    if (!toNode || toNode.projectId !== projectId) {
      return NextResponse.json({ error: "To node not found in this project" }, { status: 404 });
    }

    // Prevent self-loops
    if (validated.fromNodeId === validated.toNodeId) {
      return NextResponse.json({ error: "Cannot create edge to itself" }, { status: 400 });
    }

    // Check for cycles if relation is DEPENDS_ON
    if (validated.relation === EdgeRelation.DEPENDS_ON) {
      const existingEdges = await prisma.edge.findMany({
        where: {
          projectId,
          relation: EdgeRelation.DEPENDS_ON,
        },
      });

      if (wouldCreateCycle(existingEdges, validated)) {
        const cyclePath = findCyclePath(existingEdges, validated);
        return NextResponse.json(
          {
            error: "Cannot create edge: would create a dependency cycle",
            details: {
              cycle: cyclePath,
              message: "DEPENDS_ON edges cannot form cycles",
            },
          },
          { status: 400 }
        );
      }
    }

    // Check for duplicate edge
    const existingEdge = await prisma.edge.findUnique({
      where: {
        projectId_fromNodeId_toNodeId_relation: {
          projectId,
          fromNodeId: validated.fromNodeId,
          toNodeId: validated.toNodeId,
          relation: validated.relation,
        },
      },
    });

    if (existingEdge) {
      return NextResponse.json({ error: "Edge already exists" }, { status: 400 });
    }

    // Get project to get orgId
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { orgId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Create edge
    const edge = await prisma.edge.create({
      data: {
        orgId: project.orgId,
        projectId,
        fromNodeId: validated.fromNodeId,
        toNodeId: validated.toNodeId,
        relation: validated.relation,
      },
    });

    // Log activity
    await createActivityLog({
      projectId,
      userId: user.id,
      action: "CREATE_EDGE",
      entityType: "EDGE",
      entityId: edge.id,
      details: {
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        relation: edge.relation,
        fromNodeTitle: fromNode.title,
        toNodeTitle: toNode.title,
      },
    });

    return NextResponse.json(
      {
        id: edge.id,
        projectId: edge.projectId,
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        relation: edge.relation,
        createdAt: edge.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects/[projectId]/edges error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }

    if (error instanceof Error && error.message === "Not a member of this project") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to create edge" }, { status: 500 });
  }
}
