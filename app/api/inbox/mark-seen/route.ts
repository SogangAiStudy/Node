import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";

// POST /api/inbox/mark-seen?orgId=... - Update last seen timestamp for user's inbox in a workspace
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json(
        { error: "orgId is required" },
        { status: 400 }
      );
    }

    // Verify user is a member of this organization
    const membership = await prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "User is not a member of this organization" },
        { status: 403 }
      );
    }

    // Upsert OrgInboxState to update lastSeenAt
    const inboxState = await prisma.orgInboxState.upsert({
      where: {
        orgId_userId: {
          orgId,
          userId: user.id,
        },
      },
      update: {
        lastSeenAt: new Date(),
      },
      create: {
        orgId,
        userId: user.id,
        lastSeenAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      lastSeenAt: inboxState.lastSeenAt.toISOString(),
    });
  } catch (error) {
    console.error("POST /api/inbox/mark-seen error:", error);
    return NextResponse.json(
      { error: "Failed to update inbox state" },
      { status: 500 }
    );
  }
}
