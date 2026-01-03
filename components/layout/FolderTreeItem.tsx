"use client";

import { useState } from "react";
import { Folder, Project } from "@/hooks/use-workspace-structure";
import { ChevronRight, Folder as FolderIcon, Plus, FileText, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Draggable, Droppable } from "@hello-pangea/dnd";

interface FolderTreeItemProps {
    folder: Folder;
    orgId: string;
    level?: number;
    onCreateSubFolder?: (parentId: string) => void;
    index: number;
}

export function FolderTreeItem({ folder, orgId, level = 0, onCreateSubFolder, index }: FolderTreeItemProps) {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <Draggable draggableId={folder.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className="select-none"
                >
                    {/* Folder Row */}
                    <div
                        className={cn(
                            "flex items-center gap-2 py-1.5 px-2 hover:bg-[#2c2d31] rounded-md cursor-pointer group text-[#9ca3af] hover:text-[#e5e7eb] transition-colors",
                            snapshot.isDragging && "bg-[#2c2d31] opacity-80"
                        )}
                        style={{ paddingLeft: level === 0 ? '8px' : `${(level * 12) + 8}px` }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(!isOpen);
                        }}
                        {...provided.dragHandleProps}
                    >
                        <div className="flex items-center justify-center w-4 h-4">
                            <ChevronRight
                                className={cn(
                                    "h-3 w-3 transition-transform text-[#6b7280]",
                                    isOpen && "rotate-90"
                                )}
                            />
                        </div>

                        <FolderIcon className="h-3.5 w-3.5 text-blue-500/80 mr-1" />

                        <span className="text-sm font-medium truncate flex-1">{folder.name}</span>

                        {/* Quick Actions (Add Subfolder) */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center">
                            <button 
                                className="p-0.5 hover:bg-[#3b3c40] rounded text-[#6b7280] hover:text-white" 
                                title="Add Subfolder"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCreateSubFolder?.(folder.id);
                                }}
                            >
                                <Plus className="h-3 w-3" />
                            </button>
                        </div>
                    </div>

                    {/* Children */}
                    {isOpen && (
                        <Droppable droppableId={folder.id} type="SIDEBAR_ITEM">
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={cn(
                                        "min-h-[2px] transition-colors rounded-sm", 
                                        snapshot.isDraggingOver && "bg-[#2c2d31]/40 ring-1 ring-[#3b82f6]/20"
                                    )}
                                >
                                    {folder.children.map((child, idx) => (
                                        <FolderTreeItem 
                                            key={child.id} 
                                            folder={child} 
                                            orgId={orgId} 
                                            level={level + 1} 
                                            onCreateSubFolder={onCreateSubFolder}
                                            index={idx}
                                        />
                                    ))}
                                    {folder.projects.map((project, idx) => (
                                        <ProjectTreeItem 
                                            key={project.id} 
                                            project={project} 
                                            orgId={orgId} 
                                            level={level + 1} 
                                            index={idx + folder.children.length} // Offset index
                                        />
                                    ))}
                                    {provided.placeholder}
                                    {folder.children.length === 0 && folder.projects.length === 0 && (
                                        <div
                                            className="text-[11px] text-[#4b5563] py-1 italic"
                                            style={{ paddingLeft: `${((level + 1) * 12) + 28}px` }}
                                        >
                                            Empty
                                        </div>
                                    )}
                                </div>
                            )}
                        </Droppable>
                    )}
                </div>
            )}
        </Draggable>
    )
}

export function ProjectTreeItem({ project, orgId, level, index }: { project: Project, orgId: string, level: number, index: number }) {
    const pathname = usePathname();
    const href = `/org/${orgId}/projects/${project.id}/graph`;
    const isActive = pathname?.includes(project.id);

    return (
        <Draggable draggableId={project.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                >
                    <Link
                        href={href}
                        className={cn(
                            "flex items-center gap-2 py-1.5 px-2 rounded-md group text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#2c2d31] transition-colors block",
                            isActive && "bg-[#2c2d31] text-white font-medium",
                            snapshot.isDragging && "opacity-50"
                        )}
                        style={{ paddingLeft: `${(level * 12) + 24}px` }}
                    >
                        <FileText className="h-3.5 w-3.5 text-[#6b7280] group-hover:text-[#9ca3af] shrink-0" />
                        <span className="text-sm truncate">{project.name}</span>
                    </Link>
                </div>
            )}
        </Draggable>
    )
}