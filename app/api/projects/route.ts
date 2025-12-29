import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { createActivityLog } from "@/lib/utils/activity-log";
import { z } from "zod";

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
});

// GET /api/projects - List user's projects
export async function GET() {
  try {
    const user = await requireAuth();

    const projects = await prisma.project.findMany({
      where: {
        members: {
          some: {
            userId: user.id,
          },
        },
      },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const projectDTOs = projects.map((project) => ({
      id: project.id,
      name: project.name,
      createdAt: project.createdAt.toISOString(),
      memberCount: project._count.members,
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

    // Create project and add creator as member
    const project = await prisma.project.create({
      data: {
        name: validated.name,
        members: {
          create: {
            userId: user.id,
          },
        },
      },
    });

    // Log activity
    await createActivityLog({
      projectId: project.id,
      userId: user.id,
      action: "CREATE_PROJECT",
      entityType: "PROJECT",
      entityId: project.id,
      details: { name: project.name },
    });

    return NextResponse.json(
      {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
