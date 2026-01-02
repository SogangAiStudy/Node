import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isOrgMember } from "@/lib/utils/auth";
import { Folder } from "@prisma/client";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const user = await requireAuth();
        const { orgId } = await params;

        if (!orgId) {
            return NextResponse.json({ error: "orgId is required" }, { status: 400 });
        }

        if (!(await isOrgMember(orgId, user.id))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Fetch all folders and projects in one go
        const [folders, projects] = await Promise.all([
            prisma.folder.findMany({
                where: { orgId },
                orderBy: { sortOrder: "asc" },
            }),
            prisma.project.findMany({
                where: { orgId },
                orderBy: { sortOrder: "asc" },
                select: {
                    id: true,
                    name: true,
                    folderId: true,
                    updatedAt: true,
                    sortOrder: true,
                    primaryTeam: { select: { name: true } },
                    _count: { select: { projectTeams: true } },
                    members: {
                        where: { userId: user.id },
                        select: { isFavorite: true },
                    },
                }
            }),
        ]);

        // Build the tree
        const folderMap = new Map();
        const rootFolders: any[] = [];
        const unfiledProjects: any[] = [];

        // Initialize folder map
        folders.forEach(f => {
            folderMap.set(f.id, { ...f, children: [], projects: [] });
        });

        // Nest folders
        folders.forEach(f => {
            if (f.parentId && folderMap.has(f.parentId)) {
                folderMap.get(f.parentId).children.push(folderMap.get(f.id));
            } else {
                rootFolders.push(folderMap.get(f.id));
            }
        });

        // Place projects
        projects.forEach(p => {
            const isFavorite = p.members.length > 0 ? p.members[0].isFavorite : false;
            // Transform project to match expected DTO (flatten isFavorite)
            const projectWithFavorite = {
                id: p.id,
                name: p.name,
                folderId: p.folderId,
                updatedAt: p.updatedAt,
                sortOrder: p.sortOrder,
                primaryTeam: p.primaryTeam,
                _count: p._count,
                isFavorite
            };

            if (p.folderId && folderMap.has(p.folderId)) {
                folderMap.get(p.folderId).projects.push(projectWithFavorite);
            } else {
                unfiledProjects.push(projectWithFavorite);
            }
        });

        return NextResponse.json({
            root: {
                folders: rootFolders,
                unfiledProjects
            }
        });

    } catch (error) {
        console.error("GET workspace-structure error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
