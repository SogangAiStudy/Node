import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireProjectMembership } from "@/lib/utils/auth";
import { createActivityLog } from "@/lib/utils/activity-log";
import { z } from "zod";
import { NodeType, ManualStatus } from "@/types";

const CreateNodeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.nativeEnum(NodeType).default(NodeType.TASK),
  manualStatus: z.nativeEnum(ManualStatus).default(ManualStatus.TODO),
  ownerId: z.string().optional(),
  team: z.string().optional(),
  priority: z.number().int().min(1).max(5).default(3),
  dueAt: z.string().datetime().optional(),
});

// POST /api/projects/[projectId]/nodes - Create new node
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;

    await requireProjectMembership(projectId, user.id);

    const body = await request.json();
    const validated = CreateNodeSchema.parse(body);

    // If ownerId provided, verify they are a project member
    if (validated.ownerId) {
      await requireProjectMembership(projectId, validated.ownerId);
    }

    // Get project to get orgId
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { orgId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const ownerId = (validated.ownerId && validated.ownerId !== "unassigned") ? validated.ownerId : null;
    const teamId = (validated.team && validated.team !== "none") ? validated.team : null;

    const node = await prisma.node.create({
      data: {
        orgId: project.orgId,
        projectId,
        title: validated.title,
        description: validated.description,
        type: validated.type,
        manualStatus: validated.manualStatus,
        ownerId,
        teamId,
        priority: validated.priority,
        dueAt: validated.dueAt ? new Date(validated.dueAt) : null,
      },
      include: {
        owner: {
          select: { name: true },
        },
        team: {
          select: { name: true },
        },
      },
    });

    // Log activity
    await createActivityLog({
      projectId,
      userId: user.id,
      action: "CREATE_NODE",
      entityType: "NODE",
      entityId: node.id,
      details: {
        title: node.title,
        type: node.type,
      },
    });

    return NextResponse.json(
      {
        id: node.id,
        orgId: node.orgId,
        projectId: node.projectId,
        title: node.title,
        description: node.description,
        type: node.type,
        manualStatus: node.manualStatus,
        ownerId: node.ownerId,
        ownerName: node.owner?.name || null,
        teamId: node.teamId,
        teamName: node.team?.name || null,
        priority: node.priority,
        dueAt: node.dueAt?.toISOString() || null,
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects/[projectId]/nodes error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }

    if (error instanceof Error && error.message === "Not a member of this project") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to create node" }, { status: 500 });
  }
}
