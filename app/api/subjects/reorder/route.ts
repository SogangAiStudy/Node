import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isOrgMember } from "@/lib/utils/auth";
import { z } from "zod";

const ReorderSubjectsSchema = z.object({
    orgId: z.string(),
    items: z.array(z.object({
        id: z.string(),
        order: z.number(),
    })),
});

// PUT /api/subjects/reorder - Bulk update subject order
export async function PUT(request: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await request.json();
        const { orgId, items } = ReorderSubjectsSchema.parse(body);

        // Verify membership
        const isMember = await isOrgMember(orgId, user.id);
        if (!isMember) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Use transaction to update all
        await prisma.$transaction(
            items.map((item) =>
                prisma.subject.update({
                    where: { id: item.id },
                    data: { sortOrder: item.order },
                })
            )
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("PUT /api/subjects/reorder error:", error);
        if (error.code) console.error("Error code:", error.code);
        if (error.meta) console.error("Error meta:", error.meta);
        return NextResponse.json({ error: "Failed to reorder subjects", details: error.message }, { status: 500 });
    }
}
