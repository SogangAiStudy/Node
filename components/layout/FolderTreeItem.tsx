"use client";

import { useState } from "react";
import { Folder, Project } from "@/hooks/use-workspace-structure";
import { ChevronRight, Folder as FolderIcon, MoreHorizontal, Plus, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface FolderTreeItemProps {
    folder: Folder;
    orgId: string;
    level?: number;
}

export function FolderTreeItem({ folder, orgId, level = 0 }: FolderTreeItemProps) {
    const [isOpen, setIsOpen] = useState(true);

    // Calculate padding based on level
    // level 0: 0px, level 1: 12px, etc.
    const paddingLeft = `${level * 12}px`;

    return (
        <div className="select-none">
            {/* Folder Row */}
            <div
                className={cn(
                    "flex items-center gap-2 py-1.5 px-2 hover:bg-[#2c2d31] rounded-md cursor-pointer group text-[#9ca3af] hover:text-[#e5e7eb] transition-colors",
                )}
                style={{ paddingLeft: level === 0 ? '8px' : `${(level * 12) + 8}px` }}
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
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

                {/* Quick Actions (Add Subfolder/Project) */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center">
                    <button className="p-0.5 hover:bg-[#3b3c40] rounded text-[#6b7280] hover:text-white" title="Add Item">
                        <Plus className="h-3 w-3" />
                    </button>
                </div>
            </div>

            {/* Children */}
            {isOpen && (
                <div>
                    {folder.children.map(child => (
                        <FolderTreeItem key={child.id} folder={child} orgId={orgId} level={level + 1} />
                    ))}
                    {folder.projects.map(project => (
                        <ProjectTreeItem key={project.id} project={project} orgId={orgId} level={level + 1} />
                    ))}
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
        </div>
    )
}

export function ProjectTreeItem({ project, orgId, level }: { project: Project, orgId: string, level: number }) {
    const pathname = usePathname();
    // Assuming project URL structure: /org/[orgId]/projects/[projectId]... or just /projects if rewriter
    // Adjust logic based on Sidebar.tsx path logic
    const href = `/org/${orgId}/projects/${project.id}/graph`;
    const isActive = pathname?.includes(project.id);

    return (
        <Link
            href={href}
            className={cn(
                "flex items-center gap-2 py-1.5 px-2 rounded-md group text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#2c2d31] transition-colors block",
                isActive && "bg-[#2c2d31] text-white font-medium"
            )}
            style={{ paddingLeft: `${(level * 12) + 24}px` }} // +24 to align with folder content (indent + icon space)
        >
            <Hash className="h-3.5 w-3.5 text-[#6b7280] group-hover:text-[#9ca3af]" />
            <span className="text-sm truncate">{project.name}</span>
        </Link>
    )
}
