import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { getUserTeams } from "@/lib/utils/permissions";
import { createActivityLog } from "@/lib/utils/activity-log";
import { requestDetailsInclude, toRequestDTO } from "@/lib/utils/requests";
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
    } else if (existingRequest.targetTeamId || existingRequest.toTeam) {
      const myTeams = await getUserTeams(existingRequest.orgId, user.id);
      let targetTeamId = existingRequest.targetTeamId;

      if (!targetTeamId && existingRequest.toTeam) {
        const legacyTeam = await prisma.team.findFirst({
          where: {
            orgId: existingRequest.orgId,
            name: existingRequest.toTeam,
          },
          select: { id: true },
        });
        targetTeamId = legacyTeam?.id ?? null;
      }

      if (targetTeamId && myTeams.includes(targetTeamId)) {
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
      include: requestDetailsInclude,
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

    return NextResponse.json(toRequestDTO(updatedRequest));
  } catch (error) {
    console.error("PATCH /api/requests/[id]/respond error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to respond to request" }, { status: 500 });
  }
}
