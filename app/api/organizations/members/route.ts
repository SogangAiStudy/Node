import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isOrgAdmin } from "@/lib/utils/auth";

/**
 * GET /api/organizations/members
 * List all members of the user's current organization
 */
export async function GET() {
    try {
        const user = await requireAuth();

        // Get user's current organization
        const orgMember = await prisma.orgMember.findFirst({
            where: {
                userId: user.id,
            },
            select: {
                orgId: true,
            },
        });

        if (!orgMember) {
            return NextResponse.json({ members: [] });
        }

        const orgId = orgMember.orgId;

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
            id: om.id,
            userId: om.userId,
            name: om.user.name,
            email: om.user.email,
            image: om.user.image,
            role: om.role,
            status: om.status,
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
