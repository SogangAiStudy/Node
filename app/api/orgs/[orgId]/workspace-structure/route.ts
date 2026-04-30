import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, getUserTeams } from "@/lib/utils/auth";
import { getActiveOrgMembership } from "@/lib/utils/permissions";
import { Prisma } from "@prisma/client";

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

        const membership = await getActiveOrgMembership(orgId, user.id);
        if (!membership) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const teamIds = await getUserTeams(orgId, user.id);
        const projectWhere: Prisma.ProjectWhereInput =
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

        // Fetch all folders and projects in one go
        const [folders, projects] = await Promise.all([
            prisma.folder.findMany({
                where: { orgId },
                orderBy: { sortOrder: "asc" },
            }),
            prisma.project.findMany({
                where: projectWhere,
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

        type ProjectTreeItem = {
            id: string;
            name: string;
            folderId: string | null;
            updatedAt: Date;
            sortOrder: number;
            primaryTeam: { name: string } | null;
            _count: { projectTeams: number };
            isFavorite: boolean;
        };

        type FolderTreeItem = (typeof folders)[number] & {
            children: FolderTreeItem[];
            projects: ProjectTreeItem[];
        };

        // Build the tree
        const folderMap = new Map<string, FolderTreeItem>();
        const rootFolders: FolderTreeItem[] = [];
        const unfiledProjects: ProjectTreeItem[] = [];

        // Initialize folder map
        folders.forEach(f => {
            folderMap.set(f.id, { ...f, children: [], projects: [] });
        });

        // Nest folders
        folders.forEach(f => {
            const folder = folderMap.get(f.id);
            if (!folder) return;

            if (f.parentId && folderMap.has(f.parentId)) {
                folderMap.get(f.parentId)?.children.push(folder);
            } else {
                rootFolders.push(folder);
            }
        });

        // Place projects
        projects.forEach(p => {
            const isFavorite = p.members.length > 0 ? p.members[0].isFavorite : false;
            // Transform project to match expected DTO (flatten isFavorite)
            const projectWithFavorite: ProjectTreeItem = {
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
                folderMap.get(p.folderId)?.projects.push(projectWithFavorite);
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
