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

        const folders = await prisma.folder.findMany({
            where: { orgId },
            orderBy: { sortOrder: "asc" },
        });

        return NextResponse.json(folders);
    } catch (error) {
        console.error("GET org folders error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
