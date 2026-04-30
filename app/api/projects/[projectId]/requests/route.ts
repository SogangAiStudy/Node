import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectView } from "@/lib/utils/permissions";
import { createActivityLog } from "@/lib/utils/activity-log";
import { createNotification } from "@/lib/utils/notifications";
import { requestDetailsInclude, toRequestDTO } from "@/lib/utils/requests";
import { z } from "zod";

const CreateRequestSchema = z
  .object({
    linkedNodeId: z.string(),
    question: z.string().min(1),
    toUserId: z.string().optional(),
    targetTeamId: z.string().optional(),
    toTeam: z.string().optional(),
  })
  .refine((data) => !!(data.toUserId || data.targetTeamId || data.toTeam), {
    message: "Either toUserId or targetTeamId must be provided",
  })
  .refine((data) => {
    const recipientCount = [data.toUserId, data.targetTeamId || data.toTeam].filter(Boolean).length;
    return recipientCount === 1;
  }, {
    message: "Cannot provide both user and team recipients",
  });

// POST /api/projects/[projectId]/requests - Create new request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;

    await requireProjectView(projectId, user.id);

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

    // Get project to get orgId
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { orgId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // If toUserId provided, verify they are a project member
    if (validated.toUserId) {
      await requireProjectView(projectId, validated.toUserId);
    }

    let targetTeam = null;
    if (validated.targetTeamId || validated.toTeam) {
      targetTeam = await prisma.team.findFirst({
        where: {
          orgId: project.orgId,
          ...(validated.targetTeamId
            ? { id: validated.targetTeamId }
            : { name: validated.toTeam }),
        },
      });

      if (!targetTeam) {
        return NextResponse.json({ error: "Team not found" }, { status: 400 });
      }

      // Check if team has access to project
      const projectTeam = await prisma.projectTeam.findUnique({
        where: {
          projectId_teamId: {
            projectId,
            teamId: targetTeam.id,
          },
        },
      });

      if (!projectTeam) {
        return NextResponse.json({ error: "Team does not have access to this project" }, { status: 400 });
      }

      const teamMembers = await prisma.teamMember.findMany({
        where: {
          teamId: targetTeam.id,
          user: {
            orgMemberships: {
              some: {
                orgId: project.orgId,
                status: { in: ["ACTIVE", "PENDING_TEAM_ASSIGNMENT"] },
              },
            },
          },
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
        orgId: project.orgId,
        projectId,
        linkedNodeId: validated.linkedNodeId,
        question: validated.question,
        fromUserId: user.id,
        toUserId: validated.toUserId || null,
        targetTeamId: targetTeam?.id || null,
        toTeam: targetTeam?.name || validated.toTeam || null,
      },
      include: requestDetailsInclude,
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
        targetTeamId: req.targetTeamId,
        toTeam: req.targetTeam?.name || req.toTeam,
      },
    });

    // --- Create Notifications ---
    try {
      if (validated.toUserId && validated.toUserId !== user.id) {
        await createNotification({
          userId: validated.toUserId,
          orgId: project.orgId,
          type: "NODE_ASSIGNED", // Re-using for now
          title: "New Request",
          message: `${user.name || "A user"} sent you a request for "${req.linkedNode.title}"`,
          entityId: req.id,
        });
      }

      if (targetTeam) {
        const team = await prisma.team.findUnique({
          where: { id: targetTeam.id },
          include: { members: true }
        });

        if (team) {
          for (const member of team.members) {
            if (member.userId !== user.id) {
              await createNotification({
                userId: member.userId,
                orgId: project.orgId,
                type: "NODE_ASSIGNED",
                title: "Team Request",
                message: `A request was sent to your team for "${req.linkedNode.title}"`,
                entityId: req.id,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to create request notifications:", err);
    }

    return NextResponse.json(toRequestDTO(req), { status: 201 });
  } catch (error) {
    console.error("POST /api/projects/[projectId]/requests error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }

    if (error instanceof Error && error.message === "Not authorized to view this project") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}
