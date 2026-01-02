import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isOrgMember } from "@/lib/utils/auth";
import { z } from "zod";

const ReorderProjectsSchema = z.object({
    orgId: z.string(),
    items: z.array(z.object({
        id: z.string(),
        order: z.number(),
        subjectId: z.string().nullable().optional(),
    })),
});

// PUT /api/projects/reorder - Bulk update project order and subject assignment
export async function PUT(request: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await request.json();
        const { orgId, items } = ReorderProjectsSchema.parse(body);

        // Verify membership
        const isMember = await isOrgMember(orgId, user.id);
        if (!isMember) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Use transaction to update all
        await prisma.$transaction(
            items.map((item) =>
                prisma.project.update({
                    where: { id: item.id },
                    data: {
                        sortOrder: item.order,
                        // Only update subjectId if it is explicitly provided (including null)
                        ...(item.subjectId !== undefined ? { subjectId: item.subjectId } : {})
                    },
                })
            )
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("PUT /api/projects/reorder error:", error);
        if (error.code) console.error("Error code:", error.code);
        if (error.meta) console.error("Error meta:", error.meta);
        return NextResponse.json({ error: "Failed to reorder projects", details: error.message }, { status: 500 });
    }
}
