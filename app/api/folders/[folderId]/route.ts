import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isOrgMember } from "@/lib/utils/auth";
import { z } from "zod";

const UpdateFolderSchema = z.object({
    name: z.string().min(1).optional(),
    color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
    description: z.string().optional(),
});

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ folderId: string }> }
) {
    try {
        const user = await requireAuth();
        const { folderId } = await params;
        const body = await request.json();
        const validated = UpdateFolderSchema.parse(body);

        // Get folder to check permissions
        const folder = await prisma.folder.findUnique({
            where: { id: folderId },
            select: { orgId: true, parentId: true, name: true },
        });

        if (!folder) {
            return NextResponse.json({ error: "Folder not found" }, { status: 404 });
        }

        if (!(await isOrgMember(folder.orgId, user.id))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Check for name conflicts if renaming
        if (validated.name && validated.name !== folder.name) {
            const [existingFolder, existingProject] = await Promise.all([
                prisma.folder.findFirst({
                    where: {
                        orgId: folder.orgId,
                        parentId: folder.parentId,
                        name: validated.name,
                        id: { not: folderId },
                    }
                }),
                prisma.project.findFirst({
                    where: {
                        orgId: folder.orgId,
                        folderId: folder.parentId,
                        name: validated.name,
                    }
                })
            ]);

            if (existingFolder || existingProject) {
                return NextResponse.json({
                    error: "An item with this name already exists in this location"
                }, { status: 409 });
            }
        }

        const updatedFolder = await prisma.folder.update({
            where: { id: folderId },
            data: validated,
        });

        return NextResponse.json({ folder: updatedFolder });
    } catch (error) {
        console.error("PATCH /api/folders/[folderId] error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ folderId: string }> }
) {
    try {
        const user = await requireAuth();
        const { folderId } = await params;

        const folder = await prisma.folder.findUnique({
            where: { id: folderId },
            select: { orgId: true },
        });

        if (!folder) {
            return NextResponse.json({ error: "Folder not found" }, { status: 404 });
        }

        if (!(await isOrgMember(folder.orgId, user.id))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Delete folder (projects inside will have folderId set to null due to onDelete: SetNull)
        await prisma.folder.delete({
            where: { id: folderId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/folders/[folderId] error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
