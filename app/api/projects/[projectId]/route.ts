import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireProjectMembership } from "@/lib/utils/auth";

// GET /api/projects/[projectId] - Get project details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;

    await requireProjectMembership(projectId, user.id);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        projectTeams: {
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
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Flatten and unique-ify members
    const memberMap = new Map();
    project.projectTeams.forEach((pt: any) => {
      pt.team.members.forEach((tm: any) => {
        if (!memberMap.has(tm.userId)) {
          memberMap.set(tm.userId, {
            id: tm.id,
            userId: tm.userId,
            userName: tm.user.name,
            userEmail: tm.user.email,
            team: pt.team.name,
          });
        }
      });
    });

    return NextResponse.json({
      id: project.id,
      name: project.name,
      createdAt: project.createdAt.toISOString(),
      members: Array.from(memberMap.values()),
    });
  } catch (error) {
    console.error("GET /api/projects/[projectId] error:", error);

    if (error instanceof Error && error.message === "Not a member of this project") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}
