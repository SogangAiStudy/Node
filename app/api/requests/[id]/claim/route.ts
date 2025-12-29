import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, getUserTeam } from "@/lib/utils/auth";
import { createActivityLog } from "@/lib/utils/activity-log";

// PATCH /api/requests/[id]/claim - Claim a team request
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

    // Can only claim team requests
    if (!existingRequest.toTeam) {
      return NextResponse.json({ error: "This is not a team request" }, { status: 400 });
    }

    // Already claimed
    if (existingRequest.toUserId) {
      return NextResponse.json({ error: "Request already claimed" }, { status: 400 });
    }

    // Check if user is in the team
    const userTeam = await getUserTeam(existingRequest.projectId, user.id);
    if (userTeam !== existingRequest.toTeam) {
      return NextResponse.json(
        { error: "You are not a member of this request's team" },
        { status: 403 }
      );
    }

    // Claim request
    const updatedRequest = await prisma.request.update({
      where: { id },
      data: {
        toUserId: user.id,
        claimedAt: new Date(),
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
      action: "CLAIM_REQUEST",
      entityType: "REQUEST",
      entityId: id,
      details: {
        linkedNodeId: existingRequest.linkedNodeId,
        toTeam: existingRequest.toTeam,
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
    console.error("PATCH /api/requests/[id]/claim error:", error);
    return NextResponse.json({ error: "Failed to claim request" }, { status: 500 });
  }
}
