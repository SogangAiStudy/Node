import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, getUserTeams, isOrgAdmin } from "@/lib/utils/auth";
import { createActivityLog } from "@/lib/utils/activity-log";
import { z } from "zod";

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  primaryTeamId: z.string().optional(),
  teamIds: z.array(z.string()).min(1, "Select at least one team"),
});

// ... GET remains SAME (viewed previously) ...

// POST /api/projects - Create new project
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const validated = CreateProjectSchema.parse(body);

    // Get user's organization and teams
    const orgMember = await prisma.orgMember.findFirst({
      where: {
        userId: user.id,
        status: "ACTIVE",
      },
      select: {
        orgId: true,
      },
    });

    if (!orgMember) {
      return NextResponse.json(
        { error: "User must belong to an organization to create projects" },
        { status: 403 }
      );
    }

    // Get user's teams to verify selection
    const myTeams = await getUserTeams(orgMember.orgId, user.id);

    // Verify all selected teamIds are valid for this user
    const invalidTeams = validated.teamIds.filter(id => !myTeams.includes(id));
    if (invalidTeams.length > 0) {
      return NextResponse.json(
        { error: "Some selected teams are invalid or you are not a member of them" },
        { status: 400 }
      );
    }

    // Determine primary team (must be one of the selected teams)
    const primaryTeamId = validated.primaryTeamId || validated.teamIds[0];

    if (!validated.teamIds.includes(primaryTeamId)) {
      return NextResponse.json(
        { error: "Primary team must be one of the selected teams" },
        { status: 400 }
      );
    }

    // Create project with multiple ProjectTeam entries
    const project = await prisma.$transaction(async (tx: any) => {
      // Create project
      const newProject = await tx.project.create({
        data: {
          orgId: orgMember.orgId,
          ownerId: user.id,
          name: validated.name,
          description: validated.description || null,
          primaryTeamId: primaryTeamId,
          updatedAt: new Date(),
        },
      });

      // Create ProjectTeam entries for ALL selected teams
      await tx.projectTeam.createMany({
        data: validated.teamIds.map(teamId => ({
          orgId: orgMember.orgId,
          projectId: newProject.id,
          teamId: teamId,
          role: teamId === primaryTeamId ? "PROJECT_ADMIN" : "EDITOR",
        })),
      });

      // Log activity
      await createActivityLog({
        orgId: orgMember.orgId,
        projectId: newProject.id,
        userId: user.id,
        action: "CREATE_PROJECT",
        entityType: "PROJECT",
        entityId: newProject.id,
        details: { name: newProject.name, teams: validated.teamIds.length },
      }, tx);

      return newProject;
    });

    return NextResponse.json(
      {
        id: project.id,
        orgId: project.orgId,
        name: project.name,
        description: project.description,
        primaryTeamId: project.primaryTeamId,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
