import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, getUserTeams } from "@/lib/utils/auth";
import { getActiveOrgMembership } from "@/lib/utils/permissions";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const user = await requireAuth();
        const { orgId } = await params;

        const membership = await getActiveOrgMembership(orgId, user.id);
        if (!membership) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const teamIds = await getUserTeams(orgId, user.id);
        const where: Prisma.ProjectWhereInput =
            membership.role === "ADMIN"
                ? { orgId }
                : {
                    orgId,
                    OR: [
                        { ownerId: user.id },
                        { members: { some: { userId: user.id } } },
                        ...(teamIds.length > 0 ? [{ projectTeams: { some: { teamId: { in: teamIds } } } }] : []),
                    ],
                };

        const projects = await prisma.project.findMany({
            where,
            orderBy: { sortOrder: "asc" },
            select: {
                id: true,
                name: true,
                folderId: true,
                updatedAt: true,
                sortOrder: true,
                primaryTeam: { select: { name: true } },
            }
        });

        return NextResponse.json(projects);
    } catch (error) {
        console.error("GET org projects error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
