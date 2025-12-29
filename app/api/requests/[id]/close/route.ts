import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { createActivityLog } from "@/lib/utils/activity-log";
import { RequestStatus } from "@prisma/client";

// PATCH /api/requests/[id]/close - Close request
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Get existing request
    const existingRequest = await prisma.request.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Only creator (fromUser) or assigned user (toUser) can close
    if (
      existingRequest.fromUserId !== user.id &&
      existingRequest.toUserId !== user.id
    ) {
      return NextResponse.json(
        { error: "Only the creator or assigned user can close this request" },
        { status: 403 }
      );
    }

    // Update request
    const updatedRequest = await prisma.request.update({
      where: { id },
      data: {
        status: RequestStatus.CLOSED,
      },
      include: {
        linkedNode: {
          select: { title: true },
        },
        fromUser: {
          select: { name: true },
        },
        toUser: {
          select: { name: true },
        },
        approvedBy: {
          select: { name: true },
        },
      },
    });

    // Log activity
    await createActivityLog({
      projectId: existingRequest.projectId,
      userId: user.id,
      action: "CLOSE_REQUEST",
      entityType: "REQUEST",
      entityId: id,
      details: {
        linkedNodeId: existingRequest.linkedNodeId,
      },
    });

    return NextResponse.json({
      id: updatedRequest.id,
      projectId: updatedRequest.projectId,
      linkedNodeId: updatedRequest.linkedNodeId,
      linkedNodeTitle: updatedRequest.linkedNode.title,
      question: updatedRequest.question,
      fromUserId: updatedRequest.fromUserId,
      fromUserName: updatedRequest.fromUser.name || "Unknown",
      toUserId: updatedRequest.toUserId,
      toUserName: updatedRequest.toUser?.name || null,
      toTeam: updatedRequest.toTeam,
      status: updatedRequest.status,
      responseDraft: updatedRequest.responseDraft,
      responseFinal: updatedRequest.responseFinal,
      approvedById: updatedRequest.approvedById,
      approvedByName: updatedRequest.approvedBy?.name || null,
      approvedAt: updatedRequest.approvedAt?.toISOString() || null,
      claimedAt: updatedRequest.claimedAt?.toISOString() || null,
      createdAt: updatedRequest.createdAt.toISOString(),
      updatedAt: updatedRequest.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("PATCH /api/requests/[id]/close error:", error);
    return NextResponse.json({ error: "Failed to close request" }, { status: 500 });
  }
}
