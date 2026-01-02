import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const createOrgSchema = z.object({
  name: z.string().min(1, "Organization name is required").max(100),
  createDefaultTeam: z.boolean().optional().default(true),
});

/**
 * POST /api/organizations
 * Create a new organization and set up the user as admin
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { name, createDefaultTeam } = createOrgSchema.parse(body);

    // We no longer block users from creating/joining multiple organizations.
    // This allows them to have a 'Personal' space AND 'Team' spaces.

    // Create organization, org membership, and optionally a default team
    const result = await prisma.$transaction(async (tx: any) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name,
          ownerId: user.id,
          updatedAt: new Date(),
        },
      });

      // Create org membership for the user (as ADMIN with ACTIVE status)
      const orgMember = await tx.orgMember.create({
        data: {
          orgId: organization.id,
          userId: user.id,
          role: "ADMIN",
          status: "ACTIVE",
        },
      });

      let team = null;
      let teamMember = null;

      if (createDefaultTeam) {
        // Create default team
        team = await tx.team.create({
          data: {
            orgId: organization.id,
            name: "Default Team",
            description: "Default team for the organization",
          },
        });

        // Add user to the default team
        teamMember = await tx.teamMember.create({
          data: {
            orgId: organization.id,
            teamId: team.id,
            userId: user.id,
            role: "LEAD",
          },
        });
      }

      return { organization, orgMember, team, teamMember };
    });

    return NextResponse.json({
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        createdAt: result.organization.createdAt.toISOString(),
      },
      team: result.team
        ? {
          id: result.team.id,
          name: result.team.name,
        }
        : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error creating organization:", error);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/organizations
 * Get user's organizations
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const orgMembers = await prisma.orgMember.findMany({
      where: {
        userId: user.id,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            inviteCode: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    const organizations = orgMembers.map((om: any) => ({
      id: om.organization.id,
      name: om.organization.name,
      role: om.role,
      status: om.status,
      createdAt: om.organization.createdAt.toISOString(),
      updatedAt: om.organization.updatedAt.toISOString(),
    }));

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}
