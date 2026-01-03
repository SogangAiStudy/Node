"use client";

import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useWorkspaceStructure } from "@/hooks/use-workspace-structure";
import { FolderKanban, FileText, Star, Clock, Sparkles } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
    const params = useParams();
    const { data: session } = useSession();
    const orgId = params.orgId as string;
    const { data: structure, isLoading } = useWorkspaceStructure(orgId);

    const firstName = session?.user?.name?.split(" ")[0] || "there";

    // Get current hour for greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

    // Flatten all projects
    const getAllProjects = (folders: any[]): any[] => {
        return folders.flatMap(f => [...f.projects, ...getAllProjects(f.children || [])]);
    };

    const allProjects = structure
        ? [...(structure.root.unfiledProjects || []), ...getAllProjects(structure.root.folders || [])]
        : [];

    const favoriteProjects = allProjects.filter(p => p.isFavorite);
    const recentProjects = [...allProjects]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5);

    const folderCount = structure?.root.folders?.length || 0;
    const projectCount = allProjects.length;

    return (
        <div className="p-8 max-w-4xl mx-auto">
            {/* Welcome Header */}
            <div className="mb-10">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                    {greeting}, {firstName} <Sparkles className="inline h-6 w-6 text-yellow-400 ml-1" />
                </h1>
                <p className="text-muted-foreground">Here's what's happening in your workspace</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-10">
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/5 border border-blue-500/20 rounded-xl p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <FolderKanban className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{folderCount}</p>
                            <p className="text-xs text-muted-foreground">Folders</p>
                        </div>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/5 border border-purple-500/20 rounded-xl p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <FileText className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{projectCount}</p>
                            <p className="text-xs text-muted-foreground">Projects</p>
                        </div>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/5 border border-yellow-500/20 rounded-xl p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/20 rounded-lg">
                            <Star className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{favoriteProjects.length}</p>
                            <p className="text-xs text-muted-foreground">Favorites</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Projects */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border">
                        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" /> Recent Projects
                        </h2>
                    </div>
                    <div className="p-3">
                        {isLoading ? (
                            <p className="text-sm text-muted-foreground p-2">Loading...</p>
                        ) : recentProjects.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic p-2">No projects yet</p>
                        ) : (
                            <div className="space-y-1">
                                {recentProjects.map(project => (
                                    <Link
                                        key={project.id}
                                        href={`/org/${orgId}/projects/${project.id}/graph`}
                                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors"
                                    >
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm text-foreground flex-1 truncate">{project.name}</span>
                                        {project.isFavorite && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Favorites */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border">
                        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Star className="h-4 w-4 text-yellow-500" /> Favorites
                        </h2>
                    </div>
                    <div className="p-3">
                        {favoriteProjects.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic p-2">No favorites yet. Star a project to see it here.</p>
                        ) : (
                            <div className="space-y-1">
                                {favoriteProjects.map(project => (
                                    <Link
                                        key={project.id}
                                        href={`/org/${orgId}/projects/${project.id}/graph`}
                                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors"
                                    >
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm text-foreground truncate">{project.name}</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
