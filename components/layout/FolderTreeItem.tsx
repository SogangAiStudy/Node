"use client";

import { useState } from "react";
import { Folder, Project } from "@/hooks/use-workspace-structure";
import { ChevronRight, Folder as FolderIcon, Plus, FileText, Star, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface FolderTreeItemProps {
    folder: Folder;
    orgId: string;
    level?: number;
    onCreateSubFolder?: (parentId: string) => void;
    index: number;
}

export function FolderTreeItem({ folder, orgId, level = 0, onCreateSubFolder, index }: FolderTreeItemProps) {
    const [isOpen, setIsOpen] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(folder.name);
    const queryClient = useQueryClient();

    const handleRename = async () => {
        if (!editName.trim() || editName.trim() === folder.name) {
            setIsEditing(false);
            setEditName(folder.name);
            return;
        }

        try {
            const res = await fetch(`/api/folders/${folder.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editName.trim() }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to rename");
            }

            queryClient.invalidateQueries({ queryKey: ["workspace-structure", orgId] });
            toast.success("Folder renamed");
        } catch (error: any) {
            toast.error(error.message || "Failed to rename folder");
            setEditName(folder.name);
        }
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (!confirm(`Delete folder "${folder.name}"? Projects inside will be moved to unfiled.`)) return;

        try {
            const res = await fetch(`/api/folders/${folder.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            queryClient.invalidateQueries({ queryKey: ["workspace-structure", orgId] });
            toast.success("Folder deleted");
        } catch (error: any) {
            toast.error(error.message || "Failed to delete folder");
        }
    };

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
                            if (!isEditing) {
                                e.stopPropagation();
                                setIsOpen(!isOpen);
                            }
                        }}
                        {...provided.dragHandleProps}
                    >
                        <div className="flex items-center justify-center w-4 h-4">
                            <ChevronRight
                                className={cn(
                                    "h-3 w-3 transition-transform text-[#6b7280]",
                                    isOpen && !snapshot.isDragging && "rotate-90"
                                )}
                            />
                        </div>

                        <FolderIcon
                            className="h-3.5 w-3.5 mr-1 shrink-0"
                            style={{ color: folder.color || '#3b82f6' }}
                        />

                        {isEditing ? (
                            <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onBlur={handleRename}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleRename();
                                    if (e.key === "Escape") {
                                        setIsEditing(false);
                                        setEditName(folder.name);
                                    }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-5 text-sm py-0 px-1 bg-[#1a1b1e] border-[#3b82f6]"
                                autoFocus
                            />
                        ) : (
                            <span className="text-sm font-medium truncate flex-1">{folder.name}</span>
                        )}

                        {/* Project count badge */}
                        {!isEditing && folder.projects.length > 0 && (
                            <span className="text-[10px] text-[#6b7280] bg-[#2c2d31] px-1.5 py-0.5 rounded-full">
                                {folder.projects.length}
                            </span>
                        )}

                        {/* Quick Actions */}
                        {!isEditing && (
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
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
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            className="p-0.5 hover:bg-[#3b3c40] rounded text-[#6b7280] hover:text-white"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <MoreHorizontal className="h-3 w-3" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-32">
                                        <DropdownMenuItem onClick={(e) => {
                                            e.stopPropagation();
                                            setIsEditing(true);
                                        }}>
                                            <Pencil className="h-3 w-3 mr-2" />
                                            Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-red-500 focus:text-red-500"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete();
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3 mr-2" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </div>

                    {/* Children - hide when dragging with animation */}
                    <div
                        className={cn(
                            "transition-all duration-200 ease-in-out overflow-hidden",
                            (isOpen && !snapshot.isDragging) ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
                        )}
                    >
                        {(isOpen && !snapshot.isDragging) && (
                            <Droppable droppableId={folder.id} type="SIDEBAR_ITEM">
                                {(droppableProvided, droppableSnapshot) => (
                                    <div
                                        ref={droppableProvided.innerRef}
                                        {...droppableProvided.droppableProps}
                                        className={cn(
                                            "min-h-[8px] transition-all duration-150 rounded-sm ml-2",
                                            droppableSnapshot.isDraggingOver && "bg-blue-500/20 border-l-2 border-blue-500 pl-1"
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
                                                index={idx + folder.children.length}
                                            />
                                        ))}
                                        {droppableProvided.placeholder}
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
                </div>
            )}
        </Draggable>
    );
}

export function ProjectTreeItem({ project, orgId, level, index }: { project: Project; orgId: string; level: number; index: number }) {
    const pathname = usePathname();
    const href = `/org/${orgId}/projects/${project.id}/graph`;
    const isActive = pathname?.includes(project.id);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(project.name);
    const queryClient = useQueryClient();

    const handleRename = async () => {
        if (!editName.trim() || editName.trim() === project.name) {
            setIsEditing(false);
            setEditName(project.name);
            return;
        }

        try {
            const res = await fetch(`/api/projects/${project.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editName.trim() }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to rename");
            }

            queryClient.invalidateQueries({ queryKey: ["workspace-structure", orgId] });
            toast.success("Project renamed");
        } catch (error: any) {
            toast.error(error.message || "Failed to rename project");
            setEditName(project.name);
        }
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;

        try {
            const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            queryClient.invalidateQueries({ queryKey: ["workspace-structure", orgId] });
            toast.success("Project deleted");
        } catch (error: any) {
            toast.error(error.message || "Failed to delete project");
        }
    };

    return (
        <Draggable draggableId={project.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                >
                    <div
                        className={cn(
                            "flex flex-row items-center gap-3 py-1.5 px-2 rounded-md group text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#2c2d31] transition-colors",
                            isActive && "bg-[#2c2d31] text-white font-medium",
                            snapshot.isDragging && "opacity-50"
                        )}
                        style={{ paddingLeft: `${(level * 12) + 32}px` }}
                    >
                        <FileText className="h-4 w-4 text-[#6b7280] group-hover:text-[#9ca3af] shrink-0" />

                        {isEditing ? (
                            <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onBlur={handleRename}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleRename();
                                    if (e.key === "Escape") {
                                        setIsEditing(false);
                                        setEditName(project.name);
                                    }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-5 text-sm py-0 px-1 bg-[#1a1b1e] border-[#3b82f6] flex-1"
                                autoFocus
                            />
                        ) : (
                            <Link href={href} className="text-sm truncate flex-1">
                                {project.name}
                            </Link>
                        )}

                        {!isEditing && project.isFavorite && (
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
                        )}

                        {/* Options Menu */}
                        {!isEditing && (
                            <div className="opacity-0 group-hover:opacity-100">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            className="p-0.5 hover:bg-[#3b3c40] rounded text-[#6b7280] hover:text-white"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <MoreHorizontal className="h-3 w-3" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-32">
                                        <DropdownMenuItem onClick={(e) => {
                                            e.stopPropagation();
                                            setIsEditing(true);
                                        }}>
                                            <Pencil className="h-3 w-3 mr-2" />
                                            Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-red-500 focus:text-red-500"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete();
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3 mr-2" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Draggable>
    );
}