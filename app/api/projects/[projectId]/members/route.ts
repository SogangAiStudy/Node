import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireProjectMembership } from "@/lib/utils/auth";
import { createActivityLog } from "@/lib/utils/activity-log";
import { z } from "zod";

const AddMemberSchema = z.object({
  email: z.string().email(),
  team: z.string().optional(),
});

// GET /api/projects/[projectId]/members - Get project members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;

    await requireProjectMembership(projectId, user.id);

    const members = await prisma.projectMember.findMany({
      where: { projectId },
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

    return NextResponse.json(
      members.map((m: any) => ({
        id: m.id,
        userId: m.userId,
        userName: m.user.name,
        userEmail: m.user.email,
        userImage: m.user.image,
        team: m.team,
      }))
    );
  } catch (error) {
    console.error("GET /api/projects/[projectId]/members error:", error);

    if (error instanceof Error && error.message === "Not a member of this project") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

// POST /api/projects/[projectId]/members - Add member to project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await params;

    await requireProjectMembership(projectId, user.id);

    const body = await request.json();
    const validated = AddMemberSchema.parse(body);

    // Find user by email
    const targetUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found with that email" }, { status: 404 });
    }

    // Check if already a member
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUser.id,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json({ error: "User is already a member" }, { status: 400 });
    }

    // Add member
    const member = await prisma.projectMember.create({
      data: {
        projectId,
        userId: targetUser.id,
        team: validated.team,
      },
    });

    // Log activity
    await createActivityLog({
      projectId,
      userId: user.id,
      action: "ADD_PROJECT_MEMBER",
      entityType: "PROJECT_MEMBER",
      entityId: member.id,
      details: {
        addedUserId: targetUser.id,
        addedUserEmail: targetUser.email,
        team: validated.team,
      },
    });

    return NextResponse.json(
      {
        id: member.id,
        userId: targetUser.id,
        userName: targetUser.name,
        userEmail: targetUser.email,
        team: member.team,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects/[projectId]/members error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }

    if (error instanceof Error && error.message === "Not a member of this project") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}
