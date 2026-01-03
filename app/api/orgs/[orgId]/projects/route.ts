import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isOrgMember } from "@/lib/utils/auth";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const user = await requireAuth();
        const { orgId } = await params;

        if (!(await isOrgMember(orgId, user.id))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const projects = await prisma.project.findMany({
            where: { orgId },
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
