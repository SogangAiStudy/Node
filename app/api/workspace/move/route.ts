import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isOrgMember } from "@/lib/utils/auth";
import { z } from "zod";

const MoveItemSchema = z.object({
    orgId: z.string(),
    itemType: z.enum(["PROJECT", "FOLDER"]),
    itemId: z.string(),
    destinationParentId: z.string().nullable(), // null = root/unfiled
    newSortOrder: z.number(),
});

export async function PATCH(request: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await request.json();
        const validated = MoveItemSchema.parse(body);
        const { orgId, itemType, itemId, destinationParentId, newSortOrder } = validated;

        if (!(await isOrgMember(orgId, user.id))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (itemType === "PROJECT") {
            await prisma.project.update({
                where: { id: itemId },
                data: {
                    folderId: destinationParentId, // null is valid for root/unfiled
                    sortOrder: newSortOrder,
                },
            });
        } else if (itemType === "FOLDER") {
            // Prevent circular dependency (folder moving into its own child)
            // This is complex to check perfectly in one query, but basic check:
            if (itemId === destinationParentId) {
                return NextResponse.json({ error: "Cannot move folder into itself" }, { status: 400 });
            }

            await prisma.folder.update({
                where: { id: itemId },
                data: {
                    parentId: destinationParentId,
                    sortOrder: newSortOrder,
                },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PATCH /api/workspace/move error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
