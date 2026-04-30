import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { getUserTeams } from "@/lib/utils/permissions";
import { buildTeamRequestFilters, requestDetailsInclude, toRequestDTO } from "@/lib/utils/requests";
import { Prisma } from "@prisma/client";

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

    let requests: Prisma.RequestGetPayload<{ include: typeof requestDetailsInclude }>[] = [];

    if (mode === "mine") {
      // Get requests assigned to me personally
      requests = await prisma.request.findMany({
        where: {
          projectId,
          toUserId: user.id,
        },
        include: requestDetailsInclude,
        orderBy: { createdAt: "desc" },
      });
    } else if (mode === "team") {
      // Get requests assigned to my team(s)
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
        const teamNames = await prisma.team.findMany({
          where: {
            id: { in: targetTeams },
          },
          select: {
            name: true,
          },
        });

        requests = await prisma.request.findMany({
          where: {
            projectId,
            OR: buildTeamRequestFilters(
              targetTeams,
              teamNames.map((team) => team.name)
            ),
          },
          include: requestDetailsInclude,
          orderBy: { createdAt: "desc" },
        });
      }
    } else {
      return NextResponse.json({ error: "Invalid mode. Use 'mine' or 'team'" }, { status: 400 });
    }

    const requestDTOs = requests.map(toRequestDTO);

    return NextResponse.json({ requests: requestDTOs });
  } catch (error) {
    console.error("GET /api/requests/inbox error:", error);
    return NextResponse.json({ error: "Failed to fetch inbox" }, { status: 500 });
  }
}
