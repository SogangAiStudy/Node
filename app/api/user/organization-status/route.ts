import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/organization-status
 * Check if the current user belongs to any organization
 */
export async function GET() {
  try {
    const user = await requireAuth();

    // Check if user has any organization memberships
    const orgMember = await prisma.orgMember.findFirst({
      where: {
        userId: user.id,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!orgMember) {
      return NextResponse.json({
        hasOrganization: false,
        organization: null,
      });
    }

    return NextResponse.json({
      hasOrganization: true,
      organization: {
        id: orgMember.organization.id,
        name: orgMember.organization.name,
        role: orgMember.role,
        status: orgMember.status,
      },
    });
  } catch (error) {
    console.error("Error checking organization status:", error);
    return NextResponse.json(
      { error: "Failed to check organization status" },
      { status: 500 }
    );
  }
}
