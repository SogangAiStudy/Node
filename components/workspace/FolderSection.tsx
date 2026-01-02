import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectDTO } from "@/types";
import { ProjectCard } from "./ProjectCard";
import { Folder } from "@/lib/mock-workspace-data";
import { Droppable, Draggable } from "@hello-pangea/dnd";

interface FolderSectionProps {
    folder: Folder;
    projects: ProjectDTO[];
    orgId: string;
    onExpandToggle?: (folderId: string, isExpanded: boolean) => void;
    isDropZone?: boolean;
}

export function FolderSection({ folder, projects, orgId, onExpandToggle, isDropZone = false }: FolderSectionProps) {
    const [isExpanded, setIsExpanded] = useState(folder.isExpanded ?? true);

    const handleToggle = () => {
        const newState = !isExpanded;
        setIsExpanded(newState);
        onExpandToggle?.(folder.id, newState);
    };

    const ProjectList = (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 min-h-[50px]">
            {projects.map((project, index) => (
                isDropZone ? (
                    <Draggable key={project.id} draggableId={project.id} index={index}>
                        {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                style={{
                                    ...provided.draggableProps.style,
                                    opacity: snapshot.isDragging ? 0.5 : 1
                                }}
                            >
                                <div className="relative group">
                                    <div
                                        {...provided.dragHandleProps}
                                        className="absolute top-2 right-2 z-10 p-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing hover:bg-zinc-800 rounded"
                                    >
                                        <GripVertical className="h-4 w-4 text-zinc-400" />
                                    </div>
                                    <ProjectCard project={project} orgId={orgId} />
                                </div>
                            </div>
                        )}
                    </Draggable>
                ) : (
                    <ProjectCard key={project.id} project={project} orgId={orgId} />
                )
            ))}
            {projects.length === 0 && (
                <div className="col-span-full text-center py-8 text-sm text-muted-foreground italic">
                    No projects in this folder
                </div>
            )}
        </div>
    );

    return (
        <div className="mb-6">
            {/* Folder Header */}
            <div
                className="flex items-center justify-between px-1 py-2 mb-3 group cursor-pointer select-none"
                onClick={handleToggle}
                id={`folder-${folder.id}`}
            >
                <div className="flex items-center gap-2">
                    <ChevronRight
                        className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            isExpanded && "rotate-90"
                        )}
                    />
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        {folder.name}
                        <span className="text-xs font-normal text-muted-foreground">
                            ({projects.length})
                        </span>
                    </h3>
                    {folder.description && (
                        <span className="text-xs text-muted-foreground hidden md:inline">
                            — {folder.description}
                        </span>
                    )}
                </div>

                {/* Add Project Button (TODO: implement functionality) */}
                <Link
                    href={`/org/${orgId}/projects/new?folderId=${folder.id}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded"
                    onClick={(e) => e.stopPropagation()}
                    title="Add project to this folder"
                >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                </Link>
            </div>

            {/* Projects List */}
            {isExpanded && (
                isDropZone ? (
                    <Droppable droppableId={folder.id} type="PROJECT">
                        {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={cn(
                                    "rounded-lg transition-colors p-1",
                                    snapshot.isDraggingOver ? "bg-zinc-900/50 ring-2 ring-primary/20" : ""
                                )}
                            >
                                {ProjectList}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                ) : (
                    <div>{ProjectList}</div>
                )
            )}
        </div>
    );
}
