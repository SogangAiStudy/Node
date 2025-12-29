import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, getUserTeam } from "@/lib/utils/auth";
import { RequestDTO } from "@/types";

// GET /api/requests/inbox - Get requests in inbox (mine or team)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get("projectId");
    const mode = searchParams.get("mode") || "mine"; // mine or team
    const team = searchParams.get("team");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    let requests;

    if (mode === "mine") {
      // Get requests assigned to me personally
      requests = await prisma.request.findMany({
        where: {
          projectId,
          toUserId: user.id,
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
        orderBy: { createdAt: "desc" },
      });
    } else if (mode === "team") {
      // Get requests assigned to my team(s)
      let targetTeam = team;

      // If no team specified, get user's team from project membership
      if (!targetTeam) {
        targetTeam = await getUserTeam(projectId, user.id);
      }

      if (!targetTeam) {
        return NextResponse.json(
          { error: "User is not assigned to a team in this project" },
          { status: 400 }
        );
      }

      requests = await prisma.request.findMany({
        where: {
          projectId,
          toTeam: targetTeam,
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
        orderBy: { createdAt: "desc" },
      });
    } else {
      return NextResponse.json({ error: "Invalid mode. Use 'mine' or 'team'" }, { status: 400 });
    }

    const requestDTOs: RequestDTO[] = requests.map((req) => ({
      id: req.id,
      projectId: req.projectId,
      linkedNodeId: req.linkedNodeId,
      linkedNodeTitle: req.linkedNode.title,
      question: req.question,
      fromUserId: req.fromUserId,
      fromUserName: req.fromUser.name || "Unknown",
      toUserId: req.toUserId,
      toUserName: req.toUser?.name || null,
      toTeam: req.toTeam,
      status: req.status,
      responseDraft: req.responseDraft,
      responseFinal: req.responseFinal,
      approvedById: req.approvedById,
      approvedByName: req.approvedBy?.name || null,
      approvedAt: req.approvedAt?.toISOString() || null,
      claimedAt: req.claimedAt?.toISOString() || null,
      createdAt: req.createdAt.toISOString(),
      updatedAt: req.updatedAt.toISOString(),
    }));

    return NextResponse.json({ requests: requestDTOs });
  } catch (error) {
    console.error("GET /api/requests/inbox error:", error);
    return NextResponse.json({ error: "Failed to fetch inbox" }, { status: 500 });
  }
}
