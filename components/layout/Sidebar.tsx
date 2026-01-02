"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronDown,
  Inbox,
  FolderKanban,
  Search as SearchIcon,
  Home,
  Plus,
  Settings,
  Lock,
  Users2,
  LogOut,
  UserCircle2,
  X,
  Layers,
  Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockSubjects, searchWorkspace, enrichProjectWithWorkspaceData } from "@/lib/mock-workspace-data";

interface Workspace {
  orgId: string;
  name: string;
  hasUnreadInbox: boolean;
  status?: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  teamCount: number;
}

interface SidebarProps {
  currentOrgId: string;
}

export function Sidebar({ currentOrgId }: SidebarProps) {
  const { data: session } = useSession();
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const currentProjectId = params.projectId as string | undefined;

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  const initials = session?.user?.name
    ?.split("")
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

  // Safety redirect if currentOrgId is invalid
  useEffect(() => {
    if ((currentOrgId === "undefined" || !currentOrgId) && workspaces && workspaces.length > 0) {
      router.push(`/org/${workspaces[0].orgId}/projects`);
    }
  }, [currentOrgId, workspaces, router]);

  // Fetch projects for current workspace
  const { data: projectsData } = useQuery({
    queryKey: ["projects", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId || currentOrgId === "undefined") return { projects: [] };
      const res = await fetch(`/api/projects?orgId=${currentOrgId}`);
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json() as Promise<{ projects: Project[] }>;
    },
    enabled: !!currentOrgId && currentOrgId !== "undefined",
  });

  const currentWorkspace = workspaces?.find((w) => w.orgId === currentOrgId);
  const projects = projectsData?.projects || [];

  // Enrich projects with workspace metadata for search
  const enrichedProjects = useMemo(() => {
    return projects.map((p, i) => enrichProjectWithWorkspaceData(p, i));
  }, [projects]);

  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { projects: [], subjects: [] };
    return searchWorkspace(enrichedProjects, mockSubjects, searchQuery);
  }, [enrichedProjects, searchQuery]);

  // Categorize projects
  const privateProjects = projects.filter(p => p.teamCount <= 1);
  const sharedProjects = projects.filter(p => p.teamCount > 1);

  // Favorite projects (from enriched data)
  const favoriteProjects = enrichedProjects.filter(p => p.isFavorite);

  // Debugging
  console.log(`[DEBUG] Sidebar - currentOrgId: ${currentOrgId}`);

  // Handle search result click
  const handleSubjectClick = (subjectId: string) => {
    setSearchQuery("");
    setShowSearchResults(false);
    // Navigate to projects page and scroll to subject
    router.push(`/org/${currentOrgId}/projects#subject-${subjectId}`);
    // TODO: Trigger subject expansion
  };

  const handleProjectClick = (projectId: string) => {
    setSearchQuery("");
    setShowSearchResults(false);
    router.push(`/org/${currentOrgId}/projects/${projectId}/graph`);
  };

  const NavItem = ({
    href,
    icon: Icon,
    label,
    isActive,
    unread = false
  }: {
    href: string;
    icon: any;
    label: string;
    isActive: boolean;
    unread?: boolean;
  }) => (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors group",
        isActive
          ? "bg-[#2c2d31] text-white"
          : "text-[#d1d2d5] hover:bg-[#2c2d31] hover:text-white"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-white" : "text-[#7b7c7e] group-hover:text-[#d1d2d5]")} />
      <span className="truncate">{label}</span>
      {unread && (
        <div className="h-1.5 w-1.5 bg-[#eb5757] rounded-full ml-auto shrink-0 shadow-sm shadow-[#eb5757]/40" />
      )}
    </Link>
  );

  return (
    <div className="w-[240px] bg-[#1a1b1e] h-screen flex flex-col select-none border-r border-[#2c2d31]">
      {/* Workspace Switcher */}
      <div className="px-3 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between h-9 px-2 text-[#d1d2d5] hover:bg-[#2c2d31] hover:text-white border-transparent"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-5 h-5 rounded bg-[#37352f] flex items-center justify-center text-[10px] text-white font-bold shrink-0 shadow-sm border border-[#2c2d31]">
                  {currentWorkspace?.name?.[0] || "?"}
                </div>
                <span className="truncate text-sm font-semibold">{currentWorkspace?.name || "Workspace"}</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 ml-1 text-[#7b7c7e] shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60 bg-[#1a1b1e] border-[#2c2d31] text-[#d1d2d5]" align="start">
            <div className="px-2 py-1.5 text-[11px] font-bold text-[#7b7c7e] uppercase tracking-wider">
              Workspaces
            </div>
            {workspaces?.map((workspace) => (
              <DropdownMenuItem key={workspace.orgId} asChild className="focus:bg-[#2c2d31] focus:text-white cursor-pointer">
                <Link
                  href={`/org/${workspace.orgId}/projects`}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-4 h-4 rounded-sm bg-[#37352f] flex items-center justify-center text-[8px] text-white font-bold shrink-0">
                      {workspace.name?.[0]}
                    </div>
                    <span className="truncate text-sm">{workspace.name}</span>
                  </div>
                  {workspace.hasUnreadInbox && (
                    <div className="h-1.5 w-1.5 bg-[#eb5757] rounded-full shrink-0" />
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search Input */}
      <div className="px-3 py-2 relative">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7b7c7e]" />
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchResults(e.target.value.trim().length > 0);
            }}
            onFocus={() => searchQuery.trim() && setShowSearchResults(true)}
            className="pl-8 pr-8 h-8 bg-[#2c2d31] border-[#2c2d31] text-[#d1d2d5] placeholder:text-[#7b7c7e] focus:border-[#3b3c40]"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setShowSearchResults(false);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-[#3b3c40] rounded"
            >
              <X className="h-3.5 w-3.5 text-[#7b7c7e]" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && (searchResults.subjects.length > 0 || searchResults.projects.length > 0) && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-[#2c2d31] border border-[#3b3c40] rounded-md shadow-lg z-50 max-h-[300px] overflow-hidden">
            <ScrollArea className="max-h-[300px]">
              <div className="p-1">
                {/* Subject Results */}
                {searchResults.subjects.length > 0 && (
                  <div className="mb-2">
                    <div className="px-2 py-1 text-[10px] font-bold text-[#7b7c7e] uppercase tracking-wider">
                      Subjects
                    </div>
                    {searchResults.subjects.map((subject) => (
                      <button
                        key={subject.id}
                        onClick={() => handleSubjectClick(subject.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-[#d1d2d5] hover:bg-[#3b3c40] rounded transition-colors"
                      >
                        <Layers className="h-3.5 w-3.5 text-[#7b7c7e]" />
                        <span className="truncate">{subject.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Project Results */}
                {searchResults.projects.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-bold text-[#7b7c7e] uppercase tracking-wider">
                      Projects
                    </div>
                    {searchResults.projects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => handleProjectClick(project.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-[#d1d2d5] hover:bg-[#3b3c40] rounded transition-colors"
                      >
                        <FolderKanban className="h-3.5 w-3.5 text-[#7b7c7e]" />
                        <span className="truncate">{project.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-4 custom-scrollbar">
        {currentOrgId && currentOrgId !== "undefined" ? (
          <>
            <div className="space-y-0.5">
              <NavItem
                href={`/org/${currentOrgId}/search`}
                icon={SearchIcon}
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

            {/* Favorites Section */}
            {favoriteProjects.length > 0 && (
              <div className="mt-6 pt-2">
                <div className="flex items-center justify-between px-3 mb-1 group">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#7b7c7e] uppercase tracking-wider">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /> Favorites
                  </div>
                </div>
                <div className="space-y-0.5">
                  {favoriteProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/org/${currentOrgId}/projects/${project.id}/graph`}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-colors group",
                        currentProjectId === project.id
                          ? "bg-[#2c2d31] text-white"
                          : "text-[#d1d2d5] hover:bg-[#2c2d31] hover:text-white"
                      )}
                    >
                      <Star className={cn("h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400 opacity-60", currentProjectId === project.id && "opacity-100")} />
                      <span className="truncate">{project.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Private Section */}
            <div className="mt-6 pt-2">
              <div className="flex items-center justify-between px-3 mb-1 group">
                <div className="flex items-center gap-2 text-[11px] font-bold text-[#7b7c7e] uppercase tracking-wider">
                  <Lock className="h-3 w-3" /> Private
                </div>
                <Link
                  href={`/org/${currentOrgId}/projects/new`}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-[#2c2d31] rounded"
                >
                  <Plus className="h-3.5 w-3.5 text-[#7b7c7e]" />
                </Link>
              </div>
              <div className="space-y-0.5">
                {privateProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/org/${currentOrgId}/projects/${project.id}/graph`}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-colors group",
                      currentProjectId === project.id
                        ? "bg-[#2c2d31] text-white"
                        : "text-[#d1d2d5] hover:bg-[#2c2d31] hover:text-white"
                    )}
                  >
                    <FolderKanban className={cn("h-4 w-4 shrink-0 opacity-60", currentProjectId === project.id && "opacity-100")} />
                    <span className="truncate">{project.name}</span>
                  </Link>
                ))}
                {privateProjects.length === 0 && (
                  <div className="px-3 py-1.5 text-[12px] text-[#7b7c7e] italic">No private projects</div>
                )}
              </div>
            </div>

            {/* Shared Section */}
            <div className="mt-6">
              <div className="flex items-center justify-between px-3 mb-1 group">
                <div className="flex items-center gap-2 text-[11px] font-bold text-[#7b7c7e] uppercase tracking-wider">
                  <Users2 className="h-3 w-3" /> Shared
                </div>
              </div>
              <div className="space-y-0.5">
                {sharedProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/org/${currentOrgId}/projects/${project.id}/graph`}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-colors group",
                      currentProjectId === project.id
                        ? "bg-[#2c2d31] text-white"
                        : "text-[#d1d2d5] hover:bg-[#2c2d31] hover:text-white"
                    )}
                  >
                    <FolderKanban className={cn("h-4 w-4 shrink-0 opacity-60", currentProjectId === project.id && "opacity-100")} />
                    <span className="truncate">{project.name}</span>
                  </Link>
                ))}
                {sharedProjects.length === 0 && (
                  <div className="px-3 py-1.5 text-[12px] text-[#7b7c7e] italic">No shared projects</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="px-3 py-12 text-center">
            <p className="text-xs text-[#7b7c7e]">Please select a workspace</p>
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="mt-auto p-1.5 border-t border-[#2c2d31] bg-[#1a1b1e]/50">
        {currentOrgId && currentOrgId !== "undefined" && (
          <NavItem
            href={`/org/${currentOrgId}/settings`}
            icon={Settings}
            label="Settings"
            isActive={pathname.includes("/settings") && !pathname.includes("/profile")}
          />
        )}
        <div className="mt-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2.5 h-11 px-3 text-[#d1d2d5] hover:bg-[#2c2d31] hover:text-white"
              >
                <Avatar className="h-5 w-5 border border-[#2c2d31]">
                  <AvatarImage src={session?.user?.image || undefined} />
                  <AvatarFallback className="bg-[#37352f] text-[10px] text-white font-bold">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left truncate">
                  <div className="text-[13px] font-medium truncate">{session?.user?.name || "My Account"}</div>
                  <div className="text-[10px] text-[#7b7c7e] truncate">{session?.user?.email}</div>
                </div>
                <ChevronDown className="h-3 w-3 text-[#7b7c7e] shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-[#1a1b1e] border-[#2c2d31] text-[#d1d2d5]" align="end" side="right">
              <DropdownMenuItem asChild className="focus:bg-[#2c2d31] focus:text-white hover:bg-[#2c2d31] hover:text-white cursor-pointer">
                <Link href="/settings/profile" className="flex items-center w-full">
                  <UserCircle2 className="h-3.5 w-3.5 mr-2" />
                  <span>Profile Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#2c2d31]" />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="focus:bg-[#2c2d31] focus:text-white hover:bg-[#2c2d31] hover:text-white cursor-pointer text-red-400 focus:text-red-400"
              >
                <LogOut className="h-3.5 w-3.5 mr-2" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
