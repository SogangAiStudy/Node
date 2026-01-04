import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { getUserTeams } from "@/lib/utils/permissions";
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

    let requests: any[] = [];

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
      const myTeams = await getUserTeams(projectId, user.id); // Note: projectId passed as orgId param? No, getUserTeams takes orgId.
      // wait, getUserTeams takes (orgId, userId). We have projectId.
      // We need to fetch project to get orgId, or assume user knows orgId.
      // Actually, for this route, we need orgId.
      // Let's assume we can fetch orgId from project or we just use myTeams logic if we had orgId.
      // BUT, checking the code, we depend on projectId.
      // Let's first fetch the project to get the orgId.
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { orgId: true } });
      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

      let targetTeams: string[] = [];
      if (team) {
        // If specific team requested, check membership
        const myOrgTeams = await getUserTeams(project.orgId, user.id);
        if (!myOrgTeams.includes(team)) {
          return NextResponse.json({ error: "Not a member of this team" }, { status: 403 });
        }
        targetTeams = [team];
      } else {
        // All my teams
        targetTeams = await getUserTeams(project.orgId, user.id);
      }

      if (targetTeams.length === 0) {
        // No teams
        requests = [];
      } else {
        requests = await prisma.request.findMany({
          where: {
            projectId,
            toTeam: { in: targetTeams },
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
      }
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
    console.error("GET /api/requests/inbox error:", error);
    return NextResponse.json({ error: "Failed to fetch inbox" }, { status: 500 });
  }
}
