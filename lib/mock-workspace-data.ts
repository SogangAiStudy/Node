/**
 * Mock workspace data for Subject grouping and enhanced project metadata
 * This provides client-side mock data for the workspace UI improvements
 * TODO: Replace with backend API integration
 */

export interface Folder {
    id: string;
    name: string;
    description: string | null;
    color: string; // Hex color for folder badge/accent
    projectIds: string[]; // Projects that belong to this folder
    isExpanded?: boolean; // Client-side expand/collapse state
}

// Sample folders for testing
export const mockFolders: Folder[] = [
    {
        id: "subj-1",
        name: "Engineering",
        description: "Technical development projects",
        color: "#3b82f6", // blue
        projectIds: [],
        isExpanded: true,
    },
    {
        id: "subj-2",
        name: "Marketing",
        description: "Marketing campaigns and content",
        color: "#8b5cf6", // purple
        projectIds: [],
        isExpanded: true,
    },
    {
        id: "subj-3",
        name: "Design",
        description: "Design and creative work",
        color: "#ec4899", // pink
        projectIds: [],
        isExpanded: false,
    },
    {
        id: "subj-4",
        name: "Operations",
        description: "Business operations and processes",
        color: "#10b981", // green
        projectIds: [],
        isExpanded: false,
    },
];

// Preview thumbnail URLs (mock paths)
export const mockPreviewThumbnails = [
    "/api/placeholder/preview-1",
    "/api/placeholder/preview-2",
    "/api/placeholder/preview-3",
];

/**
 * Enrich project data with mock workspace metadata
 * This simulates what would come from the backend API
 */
export function enrichProjectWithWorkspaceData<T extends { id: string; updatedAt?: string; isFavorite?: boolean; folderId?: string | null }>(
    project: T,
    index: number = 0
): T & {
    folderId?: string;
    previewThumbnail?: string;
    lastUpdated?: string;
    isFavorite?: boolean;
} {
    // Assign preview thumbnail
    const thumbnailIndex = index % mockPreviewThumbnails.length;

    // Format last updated (use updatedAt if available, otherwise mock it)
    const lastUpdated = project.updatedAt
        ? formatRelativeTime(new Date(project.updatedAt))
        : "Recently";

    return {
        ...project,
        folderId: project.folderId || undefined,
        previewThumbnail: (project as any).previewThumbnail || mockPreviewThumbnails[thumbnailIndex],
        lastUpdated,
        isFavorite: project.isFavorite || false,
    };
}

/**
 * Group projects by folder
 */
export function groupProjectsByFolder<T extends { folderId?: string }>(
    projects: T[]
): Map<string, T[]> {
    const grouped = new Map<string, T[]>();

    // Initialize with all folders
    mockFolders.forEach((folder) => {
        grouped.set(folder.id, []);
    });

    // Add "unfiled" category for projects without a folder
    grouped.set("unfiled", []);

    // Group projects
    projects.forEach((project) => {
        const folderId = project.folderId || "unfiled";
        const existing = grouped.get(folderId) || [];
        grouped.set(folderId, [...existing, project]);
    });

    return grouped;
}

/**
 * Filter projects by workspace tab
 */
export type WorkspaceTab = "all" | "recents" | "favorites" | "unfiled";

export function filterProjectsByTab<T extends { isFavorite?: boolean; folderId?: string; updatedAt?: string }>(
    projects: T[],
    tab: WorkspaceTab
): T[] {
    switch (tab) {
        case "all":
            return projects;
        case "recents":
            // Sort by updatedAt and take top 10
            return [...projects]
                .sort((a, b) => {
                    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                    return dateB - dateA;
                })
                .slice(0, 10);
        case "favorites":
            return projects.filter((p) => p.isFavorite);
        case "unfiled":
            return projects.filter((p) => !p.folderId || p.folderId === "unfiled");
        default:
            return projects;
    }
}

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
    }
    if (diffHours > 0) {
        return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
    }
    if (diffMins > 0) {
        return diffMins === 1 ? "1 minute ago" : `${diffMins} minutes ago`;
    }
    return "Just now";
}

/**
 * Search projects and subjects by query
 */
export function searchWorkspace<T extends { name: string; description?: string | null }>(
    projects: T[],
    folders: Folder[],
    query: string
): {
    projects: T[];
    folders: Folder[];
} {
    const lowerQuery = query.toLowerCase().trim();

    if (!lowerQuery) {
        return { projects: [], folders: [] };
    }

    const matchedProjects = projects.filter(
        (p) =>
            p.name.toLowerCase().includes(lowerQuery) ||
            (p.description && p.description.toLowerCase().includes(lowerQuery))
    );

    const matchedFolders = folders.filter(
        (s) =>
            s.name.toLowerCase().includes(lowerQuery) ||
            (s.description && s.description.toLowerCase().includes(lowerQuery))
    );

    return {
        projects: matchedProjects,
        folders: matchedFolders,
    };
}
