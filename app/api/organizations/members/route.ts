import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isOrgAdmin } from "@/lib/utils/auth";

/**
 * GET /api/organizations/members
 * List all members of a specific organization
 * Query params: orgId (required)
 */
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth();

        // Get orgId from query parameters
        const { searchParams } = new URL(request.url);
        const orgId = searchParams.get('orgId');

        if (!orgId) {
            return NextResponse.json(
                { error: "orgId query parameter is required" },
                { status: 400 }
            );
        }

        // Verify user is a member of this organization
        const orgMember = await prisma.orgMember.findUnique({
            where: {
                orgId_userId: {
                    orgId,
                    userId: user.id,
                },
            },
            select: {
                orgId: true,
            },
        });

        if (!orgMember) {
            return NextResponse.json(
                { error: "Access denied to this organization" },
                { status: 403 }
            );
        }

        // Fetch all members of the organization
        const members = await prisma.orgMember.findMany({
            where: {
                orgId,
            },
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
            orderBy: {
                createdAt: "asc",
            },
        });

        // Fetch team memberships for these members
        const teamMemberships = await prisma.teamMember.findMany({
            where: {
                orgId,
            },
            include: {
                team: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        // Group team memberships by userId
        const userTeams: Record<string, Array<{ id: string; name: string; role: string }>> = {};
        teamMemberships.forEach((tm: any) => {
            if (!userTeams[tm.userId]) {
                userTeams[tm.userId] = [];
            }
            userTeams[tm.userId].push({
                id: tm.team.id,
                name: tm.team.name,
                role: tm.role,
            });
        });

        const memberDTOs = members.map((om: any) => ({
            userId: om.userId,
            userName: om.user.name,
            userEmail: om.user.email,
            userImage: om.user.image,
            role: om.role,
            status: om.status,
            teamName: userTeams[om.userId]?.[0]?.name || null,
            teams: userTeams[om.userId] || [],
            joinedAt: om.createdAt.toISOString(),
        }));

        return NextResponse.json({ members: memberDTOs });
    } catch (error) {
        console.error("GET /api/organizations/members error:", error);
        return NextResponse.json(
            { error: "Failed to fetch organization members" },
            { status: 500 }
        );
    }
}
