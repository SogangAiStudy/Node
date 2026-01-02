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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ChevronDown,
  Inbox,
  FolderKanban,
  Search,
  Plus,
  Users2,
  Lock,
  Settings,
  Home,
  PlusCircle,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut, useSession } from "next-auth/react";

interface Workspace {
  orgId: string;
  name: string;
  hasUnreadInbox: boolean;
  status: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  primaryTeamId?: string;
}

interface SidebarProps {
  currentOrgId: string;
}

export function Sidebar({ currentOrgId }: SidebarProps) {
  const { data: session } = useSession();
  const params = useParams();
  const pathname = usePathname();
  const currentProjectId = params.projectId as string | undefined;

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

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
  const { data: projectsData } = useQuery({
    queryKey: ["projects", currentOrgId],
    queryFn: async () => {
      const res = await fetch(`/api/projects?orgId=${currentOrgId}`);
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json() as Promise<{ projects: Project[] }>;
    },
    enabled: !!currentOrgId,
  });

  const projects = projectsData?.projects || [];

  // In a real Notion-like app, we'd have a 'Private' property, 
  // but for now let's just show all projects or simulate logic.
  // Let's assume projects with no primary team are 'private' or if user is owner.
  const privateProjects = projects; // Simplified for now
  const sharedProjects: Project[] = []; // To be implemented later

  const currentWorkspace = workspaces?.find((w) => w.orgId === currentOrgId);

  const NavItem = ({
    href,
    icon: Icon,
    label,
    isActive,
    unread,
    className
  }: {
    href: string;
    icon: any;
    label: string;
    isActive: boolean;
    unread?: boolean;
    className?: string;
  }) => (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-colors group relative",
        isActive
          ? "bg-[#2c2d31] text-white"
          : "text-[#d1d2d5] hover:bg-[#2c2d31] hover:text-white",
        className
      )}
    >
      <Icon className={cn(
        "h-4 w-4 shrink-0 transition-opacity",
        isActive ? "opacity-100" : "opacity-60 group-hover:opacity-100"
      )} />
      <span className="truncate">{label}</span>
      {unread && (
        <div className="absolute right-2 h-1.5 w-1.5 bg-[#eb5757] rounded-full shadow-[0_0_8px_rgba(235,87,87,0.6)]" />
      )}
    </Link>
  );

  return (
    <div className="w-[240px] bg-[#1a1b1e] h-screen flex flex-col select-none border-r border-[#2c2d31]">
      {/* Workspace Switcher - Notion-like */}
      <div className="px-2 py-3 border-b border-[#2c2d31]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#2c2d31] transition-colors group"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#5865f2] to-[#3b49df] flex items-center justify-center text-[13px] text-white font-bold shrink-0 shadow-md">
                  {currentWorkspace?.name?.[0]?.toUpperCase() || "W"}
                </div>
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="text-[14px] font-bold text-white truncate w-full">{currentWorkspace?.name || "Workspace"}</span>
                  <span className="text-[11px] text-[#7b7c7e] font-medium">
                    {currentWorkspace?.status === "ACTIVE" ? "Personal" : "Team"}
                  </span>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-[#7b7c7e] shrink-0 group-hover:text-[#d1d2d5] transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72 bg-[#2c2d31] border-[#3e3f43] text-[#d1d2d5] p-2 shadow-2xl" align="start" sideOffset={8}>
            <div className="px-2 py-2 mb-1">
              <div className="text-[11px] font-bold text-[#7b7c7e] uppercase tracking-wider mb-2">
                {session?.user?.email}
              </div>
              <div className="text-[10px] text-[#5b5c5f] font-medium">
                {workspaces?.length || 0} workspace{(workspaces?.length || 0) !== 1 ? 's' : ''}
              </div>
            </div>
            <DropdownMenuSeparator className="bg-[#3e3f43] my-1" />
            <div className="space-y-0.5 mb-1">
              {workspaces?.map((workspace) => (
                <Link key={workspace.orgId} href={`/org/${workspace.orgId}/projects`}>
                  <DropdownMenuItem
                    className={cn(
                      "cursor-pointer flex items-center gap-3 px-2 py-2.5 rounded-md transition-all",
                      workspace.orgId === currentOrgId
                        ? "bg-[#5865f2]/20 text-white border border-[#5865f2]/40"
                        : "hover:bg-[#37383d] text-[#d1d2d5]"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-md flex items-center justify-center text-[13px] font-bold shrink-0 shadow-sm",
                      workspace.orgId === currentOrgId
                        ? "bg-gradient-to-br from-[#5865f2] to-[#3b49df] text-white"
                        : "bg-[#37383d] text-[#d1d2d5]"
                    )}>
                      {workspace.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate">{workspace.name}</div>
                      <div className="text-[11px] text-[#7b7c7e] font-medium">
                        {workspace.status === "ACTIVE" ? "Personal space" : "Team workspace"}
                      </div>
                    </div>
                    {workspace.hasUnreadInbox && (
                      <div className="h-2 w-2 bg-[#eb5757] rounded-full shadow-[0_0_6px_rgba(235,87,87,0.8)] shrink-0" />
                    )}
                  </DropdownMenuItem>
                </Link>
              ))}
            </div>
            <DropdownMenuSeparator className="bg-[#3e3f43] my-1" />
            <Link href="/onboarding">
              <DropdownMenuItem className="cursor-pointer flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-[#37383d] text-[#d1d2d5]">
                <PlusCircle className="h-4 w-4 text-[#7b7c7e]" />
                <span className="text-[13px] font-semibold">Add workspace</span>
              </DropdownMenuItem>
            </Link>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-4 custom-scrollbar">
        <div className="space-y-0.5">
          <NavItem
            href={`/org/${currentOrgId}/search`}
            icon={Search}
            label="Search"
            isActive={pathname.includes("/search")}
          />
          <NavItem
            href={`/org/${currentOrgId}/projects`}
            icon={Home}
            label="Home"
            isActive={pathname === `/org/${currentOrgId}/projects`}
          />
          <NavItem
            href={`/org/${currentOrgId}/inbox`}
            icon={Inbox}
            label="Inbox"
            isActive={pathname.includes("/inbox")}
            unread={currentWorkspace?.hasUnreadInbox}
          />
        </div>

        {/* Private Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between px-3 mb-1 group">
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#7b7c7e] uppercase tracking-wider">
              <Lock className="h-3 w-3" /> Private
            </div>
            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-[#2c2d31] rounded">
              <Plus className="h-3.5 w-3.5 text-[#7b7c7e]" />
            </button>
          </div>
          <div className="space-y-0.5">
            {privateProjects.map((project) => (
              <NavItem
                key={project.id}
                href={`/org/${currentOrgId}/projects/${project.id}/graph`}
                icon={FolderKanban}
                label={project.name}
                isActive={currentProjectId === project.id}
              />
            ))}
          </div>
        </div>

        {/* Shared Section (Placeholder) */}
        <div className="mt-8">
          <div className="flex items-center justify-between px-3 mb-1 group">
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#7b7c7e] uppercase tracking-wider">
              <Users2 className="h-3 w-3" /> Shared
            </div>
            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-[#2c2d31] rounded text-[#7b7c7e]">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="px-3 py-1.5 text-[12px] text-[#7b7c7e] italic opacity-60">
            No shared projects
          </div>
        </div>
      </div>

      {/* Sidebar Footer - Settings and Profile */}
      <div className="mt-auto p-1.5 border-t border-[#2c2d31] bg-[#1a1b1e]/50">
        <NavItem
          href={`/org/${currentOrgId}/settings`}
          icon={Settings}
          label="Settings"
          isActive={pathname.includes("/settings")}
          className="mb-1"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2.5 h-10 px-3 text-[#d1d2d5] hover:bg-[#2c2d31] hover:text-white border-transparent"
            >
              <Avatar className="h-5 w-5 border border-[#2c2d31]">
                <AvatarImage src={session?.user?.image || undefined} />
                <AvatarFallback className="bg-[#37352f] text-[10px] text-white font-bold">{initials}</AvatarFallback>
              </Avatar>
              <span className="truncate text-[13px] font-medium">{session?.user?.name || "User"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-[#2c2d31] border-[#3e3f43] text-[#d1d2d5]" align="start" side="right" sideOffset={12}>
            <div className="px-3 py-2 border-b border-[#3e3f43]">
              <p className="text-[12px] font-semibold truncate">{session?.user?.name}</p>
              <p className="text-[10px] text-[#7b7c7e] truncate">{session?.user?.email}</p>
            </div>
            <DropdownMenuItem asChild className="focus:bg-[#3e3f43] focus:text-white">
              <Link href="/profile">Profile Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#3e3f43]" />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-[#eb5757] focus:bg-[#3e3f43] focus:text-[#eb5757] cursor-pointer"
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
