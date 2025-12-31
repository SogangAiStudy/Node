import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { createActivityLog } from "@/lib/utils/activity-log";
import { z } from "zod";
import { RequestStatus } from "@prisma/client";

const ApproveSchema = z.object({
  responseFinal: z.string().optional(), // If not provided, use responseDraft
});

// PATCH /api/requests/[id]/approve - Approve request (finalize response)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const validated = ApproveSchema.parse(body);

    // Get existing request
    const existingRequest = await prisma.request.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Only toUser (assigned user) can approve
    if (existingRequest.toUserId !== user.id) {
      return NextResponse.json(
        { error: "Only the assigned user can approve this request" },
        { status: 403 }
      );
    }

    // Determine final response
    const finalResponse = validated.responseFinal || existingRequest.responseDraft;

    if (!finalResponse) {
      return NextResponse.json(
        { error: "No response available to approve. Please respond first." },
        { status: 400 }
      );
    }

    // Update request
    const updatedRequest = await prisma.request.update({
      where: { id },
      data: {
        status: RequestStatus.APPROVED,
        responseFinal: finalResponse,
        approvedById: user.id,
        approvedAt: new Date(),
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
      action: "APPROVE_REQUEST",
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
    console.error("PATCH /api/requests/[id]/approve error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to approve request" }, { status: 500 });
  }
}
