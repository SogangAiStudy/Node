import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectView } from "@/lib/utils/permissions";
import { authOrPermissionErrorResponse } from "@/lib/utils/api-error-responses";

// GET /api/projects/[projectId]/members - Get project members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;

    await requireProjectView(projectId, user.id);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { orgId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get all teams assigned to this project
    const projectTeams = await prisma.projectTeam.findMany({
      where: { projectId },
      include: {
        team: {
          include: {
            members: {
              where: {
                user: {
                  orgMemberships: {
                    some: {
                      orgId: project.orgId,
                      status: { in: ["ACTIVE", "PENDING_TEAM_ASSIGNMENT"] },
                    },
                  },
                },
              },
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

    const directMembers = await prisma.projectMember.findMany({
      where: {
        projectId,
        user: {
          orgMemberships: {
            some: {
              orgId: project.orgId,
              status: { in: ["ACTIVE", "PENDING_TEAM_ASSIGNMENT"] },
            },
          },
        },
      },
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
    });

    // List of unique teams
    const teams = projectTeams.map((pt) => ({
      id: pt.team.id,
      name: pt.team.name,
    }));

    // Flatten and unique-ify members (a user could be in multiple teams)
    const memberMap = new Map();

    projectTeams.forEach((pt) => {
      pt.team.members.forEach((tm) => {
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

    directMembers.forEach((pm) => {
      if (!memberMap.has(pm.userId)) {
        memberMap.set(pm.userId, {
          id: pm.id,
          userId: pm.userId,
          userName: pm.user.name,
          userEmail: pm.user.email,
          userImage: pm.user.image,
          teamId: null,
          teamName: null,
          role: pm.role,
          isDirectMember: true,
        });
      }
    });

    return NextResponse.json({
      members: Array.from(memberMap.values()),
      teams: teams,
    });
  } catch (error) {
    const authResponse = authOrPermissionErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("GET /api/projects/[projectId]/members error:", error);
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
