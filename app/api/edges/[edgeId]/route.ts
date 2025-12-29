import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireProjectMembership } from "@/lib/utils/auth";
import { createActivityLog } from "@/lib/utils/activity-log";

// DELETE /api/edges/[edgeId] - Delete edge
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
