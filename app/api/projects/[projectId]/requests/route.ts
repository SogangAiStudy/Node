import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireProjectMembership } from "@/lib/utils/auth";
import { createActivityLog } from "@/lib/utils/activity-log";
import { z } from "zod";

const CreateRequestSchema = z
  .object({
    linkedNodeId: z.string(),
    question: z.string().min(1),
    toUserId: z.string().optional(),
    toTeam: z.string().optional(),
  })
  .refine((data) => !!(data.toUserId || data.toTeam), {
    message: "Either toUserId or toTeam must be provided",
  })
  .refine((data) => !(data.toUserId && data.toTeam), {
    message: "Cannot provide both toUserId and toTeam",
  });

// POST /api/projects/[projectId]/requests - Create new request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;

    await requireProjectMembership(projectId, user.id);

    const body = await request.json();
    const validated = CreateRequestSchema.parse(body);

    // Verify linked node exists in this project
    const linkedNode = await prisma.node.findUnique({
      where: { id: validated.linkedNodeId },
    });

    if (!linkedNode || linkedNode.projectId !== projectId) {
      return NextResponse.json(
        { error: "Linked node not found in this project" },
        { status: 404 }
      );
    }

    // If toUserId provided, verify they are a project member
    if (validated.toUserId) {
      await requireProjectMembership(projectId, validated.toUserId);
    }

    // If toTeam provided, verify at least one team member exists
    if (validated.toTeam) {
      const teamMembers = await prisma.projectMember.findMany({
        where: {
          projectId,
          team: validated.toTeam,
        },
      });

      if (teamMembers.length === 0) {
        return NextResponse.json(
          { error: "No members found in the specified team" },
          { status: 400 }
        );
      }
    }

    // Create request
    const req = await prisma.request.create({
      data: {
        projectId,
        linkedNodeId: validated.linkedNodeId,
        question: validated.question,
        fromUserId: user.id,
        toUserId: validated.toUserId || null,
        toTeam: validated.toTeam || null,
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
      },
    });

    // Log activity
    await createActivityLog({
      projectId,
      userId: user.id,
      action: "CREATE_REQUEST",
      entityType: "REQUEST",
      entityId: req.id,
      details: {
        linkedNodeId: req.linkedNodeId,
        linkedNodeTitle: req.linkedNode.title,
        toUserId: req.toUserId,
        toTeam: req.toTeam,
      },
    });

    return NextResponse.json(
      {
        id: req.id,
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
        approvedByName: null,
        approvedAt: req.approvedAt?.toISOString() || null,
        claimedAt: req.claimedAt?.toISOString() || null,
        createdAt: req.createdAt.toISOString(),
        updatedAt: req.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects/[projectId]/requests error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }

    if (error instanceof Error && error.message === "Not a member of this project") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}
