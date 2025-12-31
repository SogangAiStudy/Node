import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireProjectMembership } from "@/lib/utils/auth";

// GET /api/projects/[projectId]/members - Get project members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;

    await requireProjectMembership(projectId, user.id);

    // Get all teams assigned to this project
    const projectTeams = await prisma.projectTeam.findMany({
      where: { projectId },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // List of unique teams
    const teams = projectTeams.map((pt: any) => ({
      id: pt.team.id,
      name: pt.team.name,
    }));

    // Flatten and unique-ify members (a user could be in multiple teams)
    const memberMap = new Map();

    projectTeams.forEach((pt: any) => {
      pt.team.members.forEach((tm: any) => {
        if (!memberMap.has(tm.userId)) {
          memberMap.set(tm.userId, {
            id: tm.id,
            userId: tm.userId,
            userName: tm.user.name,
            userEmail: tm.user.email,
            userImage: tm.user.image,
            teamId: pt.team.id,
            teamName: pt.team.name,
          });
        }
      });
    });

    return NextResponse.json({
      members: Array.from(memberMap.values()),
      teams: teams,
    });
  } catch (error) {
    console.error("GET /api/projects/[projectId]/members error:", error);

    if (error instanceof Error && error.message === "Not a member of this project") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

// POST /api/projects/[projectId]/members - DEPRECATED (Use project team management instead)
export async function POST() {
  return NextResponse.json(
    { error: "Directly adding members to projects is deprecated. Please add a team to the project instead." },
    { status: 405 }
  );
}
