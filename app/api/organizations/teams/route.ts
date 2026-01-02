import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { z } from "zod";

const createTeamSchema = z.object({
    orgId: z.string().optional(), // Optional for backward compatibility, but preferred
    name: z.string().min(1, "Team name is required").max(100),
    description: z.string().max(500).optional(),
});

/**
 * POST /api/organizations/teams
 * Create a new team in a specific organization
 */
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await request.json();
        const { name, description, orgId: bodyOrgId } = createTeamSchema.parse(body);

        // Get target organization and check if user is admin
        let orgMember;
        if (bodyOrgId) {
            orgMember = await prisma.orgMember.findUnique({
                where: {
                    orgId_userId: {
                        orgId: bodyOrgId,
                        userId: user.id,
                    },
                },
                select: {
                    orgId: true,
                    role: true,
                },
            });
        } else {
            // Fallback for older clients
            orgMember = await prisma.orgMember.findFirst({
                where: {
                    userId: user.id,
                },
                select: {
                    orgId: true,
                    role: true,
                },
            });
        }

        if (!orgMember || orgMember.role !== "ADMIN") {
            return NextResponse.json(
                { error: "Only organization admins can create teams" },
                { status: 403 }
            );
        }

        const orgId = orgMember.orgId;

        // Check if team name already exists in this org
        const existingTeam = await prisma.team.findFirst({
            where: {
                orgId,
                name,
            },
        });

        if (existingTeam) {
            return NextResponse.json(
                { error: "A team with this name already exists in your organization" },
                { status: 400 }
            );
        }

        const team = await prisma.team.create({
            data: {
                orgId,
                name,
                description,
            },
        });

        return NextResponse.json({ team });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Invalid data", details: error.flatten() },
                { status: 400 }
            );
        }
        console.error("POST /api/organizations/teams error:", error);
        return NextResponse.json(
            { error: "Failed to create team" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/organizations/teams
 * List all teams in a specific organization
 * Query params: orgId (required)
 */
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth();
        const searchParams = request.nextUrl.searchParams;
        const requestedOrgId = searchParams.get("orgId");

        // Get user's organization
        let orgMember;
        if (requestedOrgId) {
            orgMember = await prisma.orgMember.findUnique({
                where: {
                    orgId_userId: {
                        orgId: requestedOrgId,
                        userId: user.id,
                    },
                },
                select: { orgId: true },
            });
        } else {
            orgMember = await prisma.orgMember.findFirst({
                where: { userId: user.id },
                select: { orgId: true },
            });
        }

        if (!orgMember) {
            return NextResponse.json(
                { error: "Access denied to this organization" },
                { status: 403 }
            );
        }

        const teams = await prisma.team.findMany({
            where: {
                orgId: orgMember.orgId,
            },
            include: {
                _count: {
                    select: {
                        members: true,
                    },
                },
            },
            orderBy: {
                name: "asc",
            },
        });

        return NextResponse.json({
            teams: teams.map((team: any) => ({
                id: team.id,
                name: team.name,
                description: team.description,
                memberCount: team._count.members,
                createdAt: team.createdAt.toISOString(),
            })),
        });
    } catch (error) {
        console.error("GET /api/organizations/teams error:", error);
        return NextResponse.json(
            { error: "Failed to fetch teams" },
            { status: 500 }
        );
    }
}
