import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isOrgMember } from "@/lib/utils/auth";
import { requireProjectView, requireProjectEdit } from "@/lib/utils/permissions";
import { z } from "zod";

const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

// GET /api/projects/[projectId] - Get project details
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

// PATCH /api/projects/[projectId] - Update project (rename)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;
    const body = await request.json();
    const validated = UpdateProjectSchema.parse(body);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { orgId: true, folderId: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Use requireProjectEdit to enforce proper mutation rights
    // (This also handles the onboarding project override)
    await requireProjectEdit(projectId, user.id);

    // Check for name conflicts if renaming
    if (validated.name && validated.name !== project.name) {
      const [existingFolder, existingProject] = await Promise.all([
        prisma.folder.findFirst({
          where: {
            orgId: project.orgId,
            parentId: project.folderId,
            name: validated.name,
          }
        }),
        prisma.project.findFirst({
          where: {
            orgId: project.orgId,
            folderId: project.folderId,
            name: validated.name,
            id: { not: projectId },
          }
        })
      ]);

      if (existingFolder || existingProject) {
        return NextResponse.json({
          error: "An item with this name already exists in this location"
        }, { status: 409 });
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: validated,
    });

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    console.error("PATCH /api/projects/[projectId] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/projects/[projectId] - Delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { orgId: true, ownerId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Use requireProjectEdit for deletion
    await requireProjectEdit(projectId, user.id);

    await prisma.project.delete({
      where: { id: projectId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/projects/[projectId] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
