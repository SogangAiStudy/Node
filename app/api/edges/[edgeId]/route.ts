import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireProjectMembership } from "@/lib/utils/auth";
import { createActivityLog } from "@/lib/utils/activity-log";
import { z } from "zod";
import { EdgeRelation } from "@prisma/client";
import { wouldCreateCycle } from "@/lib/status/cycle-detection";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ edgeId: string }> }
) {
  try {
    const user = await requireAuth();
    const { edgeId } = await params;

    // Get existing edge
    const existingEdge = await prisma.edge.findUnique({
      where: { id: edgeId },
      include: {
        fromNode: {
          select: { title: true },
        },
        toNode: {
          select: { title: true },
        },
      },
    });

    if (!existingEdge) {
      return NextResponse.json({ error: "Edge not found" }, { status: 404 });
    }

    await requireProjectMembership(existingEdge.projectId, user.id);

    // Delete edge
    await prisma.edge.delete({
      where: { id: edgeId },
    });

    // Log activity
    await createActivityLog({
      projectId: existingEdge.projectId,
      userId: user.id,
      action: "DELETE_EDGE",
      entityType: "EDGE",
      entityId: edgeId,
      details: {
        fromNodeId: existingEdge.fromNodeId,
        toNodeId: existingEdge.toNodeId,
        relation: existingEdge.relation,
        fromNodeTitle: existingEdge.fromNode.title,
        toNodeTitle: existingEdge.toNode.title,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/edges/[edgeId] error:", error);

    if (error instanceof Error && error.message === "Not a member of this project") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to delete edge" }, { status: 500 });
  }
}

const UpdateEdgeSchema = z.object({
  relation: z.nativeEnum(EdgeRelation),
});

// PATCH /api/edges/[edgeId] - Update edge relation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ edgeId: string }> }
) {
  try {
    const user = await requireAuth();
    const { edgeId } = await params;

    const existingEdge = await prisma.edge.findUnique({
      where: { id: edgeId },
      include: {
        fromNode: { select: { title: true } },
        toNode: { select: { title: true } },
      },
    });

    if (!existingEdge) {
      return NextResponse.json({ error: "Edge not found" }, { status: 404 });
    }

    await requireProjectMembership(existingEdge.projectId, user.id);

    const body = await request.json();
    const validated = UpdateEdgeSchema.parse(body);

    // If changing to DEPENDS_ON, check for cycles
    if (
      validated.relation === EdgeRelation.DEPENDS_ON &&
      existingEdge.relation !== EdgeRelation.DEPENDS_ON
    ) {
      const otherEdges = await prisma.edge.findMany({
        where: {
          projectId: existingEdge.projectId,
          relation: EdgeRelation.DEPENDS_ON,
          NOT: { id: edgeId },
        },
      });

      if (
        wouldCreateCycle(otherEdges, {
          fromNodeId: existingEdge.fromNodeId,
          toNodeId: existingEdge.toNodeId,
          relation: EdgeRelation.DEPENDS_ON,
        })
      ) {
        return NextResponse.json({ error: "Update would create a dependency cycle" }, { status: 400 });
      }
    }

    const updatedEdge = await prisma.edge.update({
      where: { id: edgeId },
      data: { relation: validated.relation },
    });

    // Log activity
    await createActivityLog({
      projectId: existingEdge.projectId,
      userId: user.id,
      action: "UPDATE_EDGE",
      entityType: "EDGE",
      entityId: edgeId,
      details: {
        oldRelation: existingEdge.relation,
        newRelation: updatedEdge.relation,
        fromNodeTitle: existingEdge.fromNode.title,
        toNodeTitle: existingEdge.toNode.title,
      },
    });

    return NextResponse.json(updatedEdge);
  } catch (error) {
    console.error("PATCH /api/edges/[edgeId] error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update edge" }, { status: 500 });
  }
}
