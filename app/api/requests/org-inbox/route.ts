import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, getUserTeams } from "@/lib/utils/auth";
import { RequestDTO } from "@/types";

// GET /api/requests/org-inbox - Get requests in inbox for entire org (mine or team)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get("orgId");
    const mode = searchParams.get("mode") || "mine"; // mine or team

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    // Verify user is a member of this org
    const membership = await prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "User is not a member of this organization" },
        { status: 403 }
      );
    }

    let requests;

    if (mode === "mine") {
      // Get requests assigned to me personally across all projects in this org
      requests = await prisma.request.findMany({
        where: {
          orgId,
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
      // Get requests assigned to my team(s) across all projects in this org
      const myTeams = await getUserTeams(orgId, user.id);

      if (myTeams.length === 0) {
        return NextResponse.json({ requests: [] });
      }

      const teamNames = await prisma.team.findMany({
        where: {
          id: { in: myTeams },
        },
        select: { name: true },
      });

      requests = await prisma.request.findMany({
        where: {
          orgId,
          toTeam: { in: teamNames.map((t) => t.name) },
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
      orgId: req.orgId,
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
    console.error("GET /api/requests/org-inbox error:", error);
    return NextResponse.json({ error: "Failed to fetch org inbox" }, { status: 500 });
  }
}
