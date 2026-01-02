import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, getUserTeams, isOrgAdmin } from "@/lib/utils/auth";
import { createActivityLog } from "@/lib/utils/activity-log";
import { z } from "zod";

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  primaryTeamId: z.string().optional(),
  subjectId: z.string().optional(),
  teamIds: z.array(z.string()).optional().default([]),
});

// GET /api/projects - List user's projects (ProjectTeam-based)
// Query params: orgId (optional) - if provided, filter by specific organization
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const requestedOrgId = searchParams.get("orgId");

    // Get user's organization
    let orgMember;
    if (requestedOrgId) {
      // Verify user is a member of the requested org
      orgMember = await prisma.orgMember.findUnique({
        where: {
          orgId_userId: {
            orgId: requestedOrgId,
            userId: user.id,
          },
          status: { in: ["ACTIVE", "PENDING_TEAM_ASSIGNMENT"] },
        },
        select: {
          orgId: true,
          role: true,
        },
      });
    } else {
      // Default to user's first active org
      orgMember = await prisma.orgMember.findFirst({
        where: {
          userId: user.id,
          status: { in: ["ACTIVE", "PENDING_TEAM_ASSIGNMENT"] },
        },
        select: {
          orgId: true,
          role: true,
        },
      });
    }

    if (!orgMember) {
      return NextResponse.json({ projects: [] });
    }

    // Check if user is org admin
    const isAdmin = await isOrgAdmin(orgMember.orgId, user.id);

    let projects;

    if (isAdmin) {
      // ADMIN sees all projects in the org
      projects = await prisma.project.findMany({
        where: {
          orgId: orgMember.orgId,
        },
        include: {
          _count: {
            select: {
              projectTeams: true,
            },
          },
          primaryTeam: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } else {
      // MEMBER sees only projects their teams have access to
      const myTeams = await getUserTeams(orgMember.orgId, user.id);

      projects = await prisma.project.findMany({
        where: {
          orgId: orgMember.orgId,
          projectTeams: {
            some: {
              teamId: {
                in: myTeams,
              },
            },
          },
        },
        include: {
          _count: {
            select: {
              projectTeams: true,
            },
          },
          primaryTeam: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    const projectDTOs = projects.map((project: any) => ({
      id: project.id,
      orgId: project.orgId,
      name: project.name,
      description: project.description,
      primaryTeamId: project.primaryTeamId,
      primaryTeamName: project.primaryTeam?.name || null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      subjectId: project.subjectId,
      teamCount: project._count.projectTeams,
      memberCount: project._count.projectTeams, // For UI compatibility
    }));

    return NextResponse.json({ projects: projectDTOs });
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

// POST /api/projects - Create new project
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const validated = CreateProjectSchema.parse(body);

    // Get user's organization and teams
    const requestedOrgId = body.orgId;

    const orgMember = await prisma.orgMember.findFirst({
      where: {
        userId: user.id,
        status: { in: ["ACTIVE", "PENDING_TEAM_ASSIGNMENT"] },
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

    // Get all teams in the organization to verify selection
    const orgTeams = await prisma.team.findMany({
      where: { orgId: orgMember.orgId },
      select: { id: true },
    });
    const orgTeamIds = orgTeams.map((t: any) => t.id);

    // Verify all selected teamIds belong to this organization
    const invalidTeams = validated.teamIds.filter(id => !orgTeamIds.includes(id));
    if (invalidTeams.length > 0) {
      return NextResponse.json(
        { error: "Some selected teams are invalid or do not belong to your organization" },
        { status: 400 }
      );
    }

    // Determine primary team (must be one of the selected teams if teams are selected)
    let primaryTeamId = validated.primaryTeamId || (validated.teamIds.length > 0 ? validated.teamIds[0] : null);

    if (primaryTeamId && !validated.teamIds.includes(primaryTeamId)) {
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
          subjectId: validated.subjectId || null,
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
