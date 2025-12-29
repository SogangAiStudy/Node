import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, getUserTeam } from "@/lib/utils/auth";
import { createActivityLog } from "@/lib/utils/activity-log";
import { z } from "zod";
import { RequestStatus } from "@prisma/client";

const RespondSchema = z.object({
  responseDraft: z.string().min(1),
});

// PATCH /api/requests/[id]/respond - Add response draft to request
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const validated = RespondSchema.parse(body);

    // Get existing request
    const existingRequest = await prisma.request.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Check authorization: must be toUser OR in toTeam
    let authorized = false;

    if (existingRequest.toUserId === user.id) {
      authorized = true;
    } else if (existingRequest.toTeam) {
      const userTeam = await getUserTeam(existingRequest.projectId, user.id);
      if (userTeam === existingRequest.toTeam) {
        authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update request
    const updatedRequest = await prisma.request.update({
      where: { id },
      data: {
        responseDraft: validated.responseDraft,
        status: RequestStatus.RESPONDED,
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
      action: "RESPOND_REQUEST",
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
    console.error("PATCH /api/requests/[id]/respond error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to respond to request" }, { status: 500 });
  }
}
