"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Inbox, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";

interface Workspace {
  orgId: string;
  name: string;
  hasUnreadInbox: boolean;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
}

interface SidebarProps {
  currentOrgId: string;
}

export function Sidebar({ currentOrgId }: SidebarProps) {
  const params = useParams();
  const pathname = usePathname();
  const currentProjectId = params.projectId as string | undefined;

  // Fetch workspaces with unread indicators
  const { data: workspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const res = await fetch("/api/workspaces");
      if (!res.ok) throw new Error("Failed to fetch workspaces");
      return res.json() as Promise<Workspace[]>;
    },
  });

  // Fetch projects for current workspace
  const { data: projects } = useQuery({
    queryKey: ["projects", currentOrgId],
    queryFn: async () => {
      const res = await fetch(`/api/projects?orgId=${currentOrgId}`);
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json() as Promise<{ projects: Project[] }>;
    },
    enabled: !!currentOrgId,
  });

  const currentWorkspace = workspaces?.find((w) => w.orgId === currentOrgId);
  const isInboxActive = pathname.includes("/inbox") && !currentProjectId;

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
      {/* Workspace Switcher */}
      <div className="p-4 border-b border-gray-200">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between font-medium text-left"
            >
              <span className="truncate">{currentWorkspace?.name || "Select workspace"}</span>
              <ChevronDown className="h-4 w-4 ml-2 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            {workspaces?.map((workspace) => (
              <DropdownMenuItem key={workspace.orgId} asChild>
                <Link
                  href={`/org/${workspace.orgId}/projects`}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate">{workspace.name}</span>
                  {workspace.hasUnreadInbox && (
                    <div className="h-2 w-2 bg-red-500 rounded-full shrink-0" />
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {/* Inbox Link */}
          <Link
            href={`/org/${currentOrgId}/inbox`}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isInboxActive
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <Inbox className="h-4 w-4 shrink-0" />
            <span>Inbox</span>
            {currentWorkspace?.hasUnreadInbox && (
              <div className="h-2 w-2 bg-red-500 rounded-full ml-auto shrink-0" />
            )}
          </Link>

          {/* Projects Section */}
          <div className="pt-4">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Projects
            </div>
            <div className="space-y-1">
              {projects?.projects.map((project) => {
                const isActive = currentProjectId === project.id;
                return (
                  <Link
                    key={project.id}
                    href={`/org/${currentOrgId}/projects/${project.id}/graph`}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-indigo-50 text-indigo-700 border-l-2 border-indigo-600"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <FolderKanban className="h-4 w-4 shrink-0" />
                    <span className="truncate">{project.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
