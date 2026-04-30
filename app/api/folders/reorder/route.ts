import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isOrgMember } from "@/lib/utils/auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const ReorderFoldersSchema = z.object({
    orgId: z.string(),
    items: z.array(z.object({
        id: z.string(),
        order: z.number(), // Mapped to sortOrder in DB
        parentId: z.string().nullable().optional(), // Support moving between parents
    })),
});

// PUT /api/folders/reorder - Bulk update folder order
export async function PUT(request: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await request.json();
        const { orgId, items } = ReorderFoldersSchema.parse(body);

        // Verify membership
        const isMember = await isOrgMember(orgId, user.id);
        if (!isMember) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Use transaction to update all
        await prisma.$transaction(
            items.map((item) =>
                prisma.folder.update({
                    where: { id: item.id },
                    data: {
                        sortOrder: item.order,
                        ...(item.parentId !== undefined ? { parentId: item.parentId } : {})
                    },
                })
            )
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PUT /api/folders/reorder error:", error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error("Error code:", error.code);
            console.error("Error meta:", error.meta);
        }
        const details = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: "Failed to reorder folders", details }, { status: 500 });
    }
}
