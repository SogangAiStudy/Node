import { useQuery } from "@tanstack/react-query";

export interface Project {
    id: string;
    name: string;
    folderId: string | null;
    sortOrder: number;
    updatedAt: string;
    primaryTeam: { name: string | null } | null;
    _count: { projectTeams: number };
    isFavorite?: boolean;
}

export interface Folder {
    id: string;
    name: string;
    description?: string | null;
    color?: string;
    orgId: string;
    parentId: string | null;
    sortOrder: number;
    children: Folder[];
    projects: Project[];
}

export interface WorkspaceStructure {
    root: {
        folders: Folder[];
        unfiledProjects: Project[];
    };
}

export const useWorkspaceStructure = (orgId: string) => {
    return useQuery<WorkspaceStructure>({
        queryKey: ["workspace-structure", orgId],
        queryFn: async () => {
            const res = await fetch(`/api/orgs/${orgId}/workspace-structure`);
            if (!res.ok) throw new Error("Failed to fetch workspace structure");
            return res.json();
        },
        enabled: !!orgId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};
