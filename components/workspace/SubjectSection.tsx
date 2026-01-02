"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectDTO } from "@/types";
import { ProjectCard } from "./ProjectCard";
import { Subject } from "@/lib/mock-workspace-data";

interface SubjectSectionProps {
    subject: Subject;
    projects: ProjectDTO[];
    orgId: string;
    onExpandToggle?: (subjectId: string, isExpanded: boolean) => void;
}

export function SubjectSection({ subject, projects, orgId, onExpandToggle }: SubjectSectionProps) {
    const [isExpanded, setIsExpanded] = useState(subject.isExpanded ?? true);

    const handleToggle = () => {
        const newState = !isExpanded;
        setIsExpanded(newState);
        onExpandToggle?.(subject.id, newState);
    };

    return (
        <div className="mb-6">
            {/* Subject Header */}
            <div
                className="flex items-center justify-between px-1 py-2 mb-3 group cursor-pointer select-none"
                onClick={handleToggle}
                id={`subject-${subject.id}`}
            >
                <div className="flex items-center gap-2">
                    <ChevronRight
                        className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            isExpanded && "rotate-90"
                        )}
                    />
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        {subject.name}
                        <span className="text-xs font-normal text-muted-foreground">
                            ({projects.length})
                        </span>
                    </h3>
                    {subject.description && (
                        <span className="text-xs text-muted-foreground hidden md:inline">
                            — {subject.description}
                        </span>
                    )}
                </div>

                {/* Add Subject Button (TODO: implement functionality) */}
                <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded"
                    onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Show create subject dialog
                        console.log("Create new project in subject:", subject.id);
                    }}
                    title="Add project to this subject"
                >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
            </div>

            {/* Projects List */}
            {isExpanded && (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map((project) => (
                        <ProjectCard key={project.id} project={project} orgId={orgId} />
                    ))}
                    {projects.length === 0 && (
                        <div className="col-span-full text-center py-8 text-sm text-muted-foreground italic">
                            No projects in this subject
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
