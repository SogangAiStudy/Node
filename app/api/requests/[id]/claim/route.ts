import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { getUserTeams } from "@/lib/utils/permissions";
import { createActivityLog } from "@/lib/utils/activity-log";
import { requestDetailsInclude, toRequestDTO } from "@/lib/utils/requests";

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
    if (!existingRequest.targetTeamId && !existingRequest.toTeam) {
      return NextResponse.json({ error: "This is not a team request" }, { status: 400 });
    }

    // Already claimed
    if (existingRequest.toUserId) {
      return NextResponse.json({ error: "Request already claimed" }, { status: 400 });
    }

    // Check if user is in the team
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

    if (!targetTeamId || !myTeams.includes(targetTeamId)) {
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
      include: requestDetailsInclude,
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
        targetTeamId: existingRequest.targetTeamId,
        toTeam: existingRequest.toTeam,
      },
    });

    return NextResponse.json(toRequestDTO(updatedRequest));
  } catch (error) {
    console.error("PATCH /api/requests/[id]/claim error:", error);
    return NextResponse.json({ error: "Failed to claim request" }, { status: 500 });
  }
}
