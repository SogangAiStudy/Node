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
            // Get project name to check for conflicts
            const project = await prisma.project.findUnique({
                where: { id: itemId },
                select: { name: true }
            });

            if (!project) {
                return NextResponse.json({ error: "Project not found" }, { status: 404 });
            }

            // Check for name conflicts at destination
            const [existingFolder, existingProject] = await Promise.all([
                prisma.folder.findFirst({
                    where: {
                        orgId,
                        parentId: destinationParentId,
                        name: project.name,
                    }
                }),
                prisma.project.findFirst({
                    where: {
                        orgId,
                        folderId: destinationParentId,
                        name: project.name,
                        id: { not: itemId }, // exclude self
                    }
                })
            ]);

            if (existingFolder || existingProject) {
                return NextResponse.json({
                    error: "An item with this name already exists at the destination"
                }, { status: 409 });
            }

            await prisma.project.update({
                where: { id: itemId },
                data: {
                    folderId: destinationParentId,
                    sortOrder: newSortOrder,
                },
            });
        } else if (itemType === "FOLDER") {
            // Prevent circular dependency (folder moving into itself)
            if (itemId === destinationParentId) {
                return NextResponse.json({ error: "Cannot move folder into itself" }, { status: 400 });
            }

            // Prevent moving folder into its own descendant
            if (destinationParentId) {
                // Walk up the ancestor chain from destination to check if itemId is an ancestor
                let currentParentId: string | null = destinationParentId;
                const visited = new Set<string>();

                while (currentParentId) {
                    if (currentParentId === itemId) {
                        return NextResponse.json({
                            error: "Cannot move folder into its own subfolder"
                        }, { status: 400 });
                    }

                    // Prevent infinite loop in case of existing bad data
                    if (visited.has(currentParentId)) break;
                    visited.add(currentParentId);

                    const parent = await prisma.folder.findUnique({
                        where: { id: currentParentId },
                        select: { parentId: true }
                    });
                    currentParentId = parent?.parentId || null;
                }
            }

            // Get folder name to check for conflicts
            const movingFolder = await prisma.folder.findUnique({
                where: { id: itemId },
                select: { name: true }
            });

            if (!movingFolder) {
                return NextResponse.json({ error: "Folder not found" }, { status: 404 });
            }

            // Check for name conflicts at destination
            const [existingFolder, existingProject] = await Promise.all([
                prisma.folder.findFirst({
                    where: {
                        orgId,
                        parentId: destinationParentId,
                        name: movingFolder.name,
                        id: { not: itemId }, // exclude self
                    }
                }),
                prisma.project.findFirst({
                    where: {
                        orgId,
                        folderId: destinationParentId,
                        name: movingFolder.name,
                    }
                })
            ]);

            if (existingFolder || existingProject) {
                return NextResponse.json({
                    error: "An item with this name already exists at the destination"
                }, { status: 409 });
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
