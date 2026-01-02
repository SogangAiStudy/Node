"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Clock } from "lucide-react";
import { ProjectDTO } from "@/types";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
    project: ProjectDTO;
    orgId: string;
}

export function ProjectCard({ project, orgId }: ProjectCardProps) {
    return (
        <Link href={`/org/${orgId}/projects/${project.id}/graph`}>
            <Card className="h-full hover:shadow-md transition-all cursor-pointer group border border-border hover:border-primary/50">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <FolderKanban className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate">{project.name}</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {/* Preview Thumbnail */}
                    {project.previewThumbnail && (
                        <div className="w-full h-28 bg-muted rounded-md overflow-hidden border border-border">
                            <div className="w-full h-full flex items-center justify-center">
                                {/* TODO: Replace with actual preview image */}
                                <div className="text-xs text-muted-foreground text-center px-4">
                                    Node graph preview
                                    <br />
                                    <span className="text-[10px]">(placeholder)</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    {project.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                            {project.description}
                        </p>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                        <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{project.lastUpdated || "Recently updated"}</span>
                        </div>
                        {project.primaryTeamName && (
                            <span className="truncate max-w-[120px]" title={project.primaryTeamName}>
                                {project.primaryTeamName}
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
