"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Clock } from "lucide-react";
import { ProjectDTO } from "@/types";
import { Project } from "@/hooks/use-workspace-structure";

interface ProjectCardProps {
    project: ProjectDTO | Project;
    orgId: string;
}

export function ProjectCard({ project, orgId }: ProjectCardProps) {
    const lastUpdated = ("lastUpdated" in project ? project.lastUpdated : undefined) ||
        (project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : "Recently updated");
    const description = "description" in project ? project.description : null;

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
                    {/* Description */}
                    {description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                            {description}
                        </p>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                        <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{lastUpdated}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
