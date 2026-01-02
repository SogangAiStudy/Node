import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isOrgAdmin } from "@/lib/utils/auth";

/**
 * GET /api/organizations/members?orgId=...
 * List all members of a specific organization
 */
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth();
        const searchParams = request.nextUrl.searchParams;
        const requestedOrgId = searchParams.get("orgId");

        // Get user's membership in the target organization
        let orgMember;
        if (requestedOrgId) {
            orgMember = await prisma.orgMember.findUnique({
                where: {
                    orgId_userId: {
                        orgId: requestedOrgId,
                        userId: user.id,
                    },
                },
                select: {
                    orgId: true,
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
                },
            });
        }

        if (!orgMember) {
            return NextResponse.json(
                { error: "Access denied to this organization" },
                { status: 403 }
            );
        }

        // Fetch all members of the organization
        const members = await prisma.orgMember.findMany({
            where: {
                orgId: orgMember.orgId,
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
                orgId: orgMember.orgId,
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
