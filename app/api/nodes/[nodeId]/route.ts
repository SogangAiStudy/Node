import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectView } from "@/lib/utils/permissions";
import { createActivityLog } from "@/lib/utils/activity-log";
import { z } from "zod";
import { NodeType, ManualStatus } from "@/types";
import { triggerUnblockedNotifications, createNotification, triggerNodeAssignmentNotifications } from "@/lib/utils/notifications";

const UpdateNodeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  type: z.nativeEnum(NodeType).optional(),
  manualStatus: z.nativeEnum(ManualStatus).optional(),
  ownerId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  teamIds: z.array(z.string()).optional(),
  ownerIds: z.array(z.string()).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

// PATCH /api/nodes/[nodeId] - Update node
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const user = await requireAuth();
    const { nodeId } = await params;

    const body = await request.json();
    console.log(`PATCH /api/nodes/${nodeId} - body:`, body);
    const validated = UpdateNodeSchema.parse(body);

    // Get existing node with relations for comparison
    const existingNode = await prisma.node.findUnique({
      where: { id: nodeId },
      include: {
        nodeOwners: true,
        nodeTeams: true,
      },
    });

    if (!existingNode) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    await requireProjectView(existingNode.projectId, user.id);

    // Verify all new owners are project members
    if (validated.ownerIds) {
      for (const oid of validated.ownerIds) {
        await requireProjectView(existingNode.projectId, oid);
      }
    } else if (validated.ownerId !== undefined && validated.ownerId !== null) {
      await requireProjectView(existingNode.projectId, validated.ownerId);
    }

    // Update node
    const node = await prisma.node.update({
      where: { id: nodeId },
      data: {
        ...(validated.title !== undefined && { title: validated.title }),
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.type !== undefined && { type: validated.type }),
        ...(validated.manualStatus !== undefined && { manualStatus: validated.manualStatus }),
        ...(validated.ownerId !== undefined && { ownerId: validated.ownerId }),
        ...(validated.teamId !== undefined && { teamId: validated.teamId }),
        ...(validated.priority !== undefined && { priority: validated.priority }),
        ...(validated.dueAt !== undefined && {
          dueAt: validated.dueAt ? new Date(validated.dueAt) : null,
        }),
        ...(validated.positionX !== undefined && { positionX: validated.positionX }),
        ...(validated.positionY !== undefined && { positionY: validated.positionY }),
        ...(validated.teamIds !== undefined && {
          nodeTeams: {
            deleteMany: {},
            create: validated.teamIds.map(tid => ({ teamId: tid }))
          }
        }),
        ...(validated.ownerIds !== undefined && {
          nodeOwners: {
            deleteMany: {},
            create: validated.ownerIds.map(oid => ({ userId: oid }))
          }
        })
      },
      include: {
        owner: { select: { name: true } },
        team: { select: { name: true } },
        nodeTeams: { include: { team: { select: { id: true, name: true } } } },
        nodeOwners: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    // Log activity
    await createActivityLog({
      projectId: existingNode.projectId,
      userId: user.id,
      action: "UPDATE_NODE",
      entityType: "NODE",
      entityId: node.id,
      details: validated,
    });

    // --- Notifications logic ---

    // 1. Trigger unblocked notifications if status changed to DONE
    if (validated.manualStatus === "DONE" && existingNode.manualStatus !== "DONE") {
      await triggerUnblockedNotifications(node.id, node.orgId);
    }

    // 2. Trigger assignment notifications for NEW assignees
    const newOwnerIds = validated.ownerIds || (validated.ownerId ? [validated.ownerId] : []);
    const oldOwnerIds = existingNode.nodeOwners.map(no => no.userId).concat(existingNode.ownerId ? [existingNode.ownerId] : []);
    const trulyNewOwners = newOwnerIds.filter(id => !oldOwnerIds.includes(id) && id !== user.id);

    const newTeamIds = validated.teamIds || (validated.teamId ? [validated.teamId] : []);
    const oldTeamIds = existingNode.nodeTeams.map(nt => nt.teamId).concat(existingNode.teamId ? [existingNode.teamId] : []);
    const trulyNewTeams = newTeamIds.filter(id => !oldTeamIds.includes(id));

    if (trulyNewOwners.length > 0 || trulyNewTeams.length > 0) {
      await triggerNodeAssignmentNotifications({
        nodeId: node.id,
        orgId: node.orgId,
        title: node.title,
        ownerIds: trulyNewOwners,
        teamIds: trulyNewTeams,
        isNew: false,
      });
    }

    // 3. Trigger "Node Updated" notifications for existing assignees if title/status/priority changed
    const significantChange =
      (validated.title !== undefined && validated.title !== existingNode.title) ||
      (validated.manualStatus !== undefined && validated.manualStatus !== existingNode.manualStatus) ||
      (validated.priority !== undefined && validated.priority !== existingNode.priority);

    if (significantChange) {
      const currentAssignees = node.nodeOwners.map(no => no.userId);
      const currentTeams = node.nodeTeams.map(nt => nt.teamId);

      // Notify users (excluding current actor and those we just notified for assignment)
      for (const userId of currentAssignees) {
        if (userId !== user.id && !trulyNewOwners.includes(userId)) {
          await createNotification({
            userId,
            orgId: node.orgId,
            type: "NODE_UPDATED",
            title: "Node Updated",
            message: `The node "${node.title}" has been updated.`,
            entityId: node.id,
            dedupeKey: `NODE_UPDATE:${node.id}:${userId}:${Date.now() / (1000 * 60 * 5) | 0}`, // 5 min dedupe
          });
        }
      }

      // Notify teams (excluding those we just notified for assignment)
      for (const teamId of currentTeams) {
        if (!trulyNewTeams.includes(teamId)) {
          await createNotification({
            orgId: node.orgId,
            type: "NODE_UPDATED",
            targetType: "TEAM",
            targetTeamId: teamId,
            title: "Node Updated",
            message: `The node "${node.title}" assigned to your team has been updated.`,
            entityId: node.id,
            dedupeKey: `NODE_UPDATE_TEAM:${node.id}:${teamId}:${Date.now() / (1000 * 60 * 5) | 0}`, // 5 min dedupe
          });
        }
      }
    }

    return NextResponse.json({
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
      teams: node.nodeTeams.map((nt: any) => ({ id: nt.team.id, name: nt.team.name })),
      owners: node.nodeOwners.map((no: any) => ({ id: no.user.id, name: no.user.name })),
      priority: node.priority,
      dueAt: node.dueAt?.toISOString() || null,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("PATCH /api/nodes/[nodeId] error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }

    if (error instanceof Error && error.message === "Not a member of this project") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to update node" }, { status: 500 });
  }
}

// DELETE /api/nodes/[nodeId] - Delete node (cascade edges and requests)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const user = await requireAuth();
    const { nodeId } = await params;

    // Get existing node
    const existingNode = await prisma.node.findUnique({
      where: { id: nodeId },
    });

    if (!existingNode) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    await requireProjectView(existingNode.projectId, user.id);

    // Delete node and decrement organization nodeCount in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.node.delete({
        where: { id: nodeId },
      });

      await tx.organization.update({
        where: { id: existingNode.orgId },
        data: { nodeCount: { decrement: 1 } },
      });
    });

    // Log activity
    await createActivityLog({
      projectId: existingNode.projectId,
      userId: user.id,
      action: "DELETE_NODE",
      entityType: "NODE",
      entityId: nodeId,
      details: {
        title: existingNode.title,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/nodes/[nodeId] error:", error);

    if (error instanceof Error && error.message === "Not a member of this project") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to delete node" }, { status: 500 });
  }
}
