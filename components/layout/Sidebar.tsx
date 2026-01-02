"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
import { SubjectCreationModal } from "@/components/workspace/SubjectCreationModal";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { toast } from "sonner";

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
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);

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

  // Safety redirect if currentOrgId is invalid or missing
  useEffect(() => {
    if (workspaces && workspaces.length > 0) {
      // 1. If no orgId or "undefined" in URL
      if (!currentOrgId || currentOrgId === "undefined") {
        console.log("[DEBUG] Sidebar - No orgId in URL. Redirecting to first workspace...");
        router.push(`/org/${workspaces[0].orgId}/projects`);
        return;
      }

      // 2. If current orgId is NOT in the user's workspace list
      const isValid = workspaces.some(w => w.orgId === currentOrgId);
      if (!isValid) {
        console.log(`[DEBUG] Sidebar - User has no access to org ${currentOrgId}. Redirecting to first available workspace...`);
        router.push(`/org/${workspaces[0].orgId}/projects`);
      }
    }
  }, [currentOrgId, workspaces, router]);

  // Keyboard shortcut for search
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSearchModalOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

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

  // Fetch subjects for current workspace
  const { data: subjectsData, refetch: refetchSubjects } = useQuery({
    queryKey: ["subjects", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId || currentOrgId === "undefined") return { subjects: [] };
      const res = await fetch(`/api/subjects?orgId=${currentOrgId}`);
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return res.json() as Promise<{ subjects: any[] }>;
    },
    enabled: !!currentOrgId && currentOrgId !== "undefined",
  });

  const handleCreateSubject = async (name: string) => {
    try {
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: currentOrgId, name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create subject");
      }

      // Refetch subjects
      refetchSubjects();
      setIsSubjectModalOpen(false);
      toast.success("Subject created");
    } catch (error: any) {
      console.error("Failed to create subject:", error);
      toast.error(error.message || "Failed to create subject");
    }
  };

  const currentWorkspace = workspaces?.find((w) => w.orgId === currentOrgId);
  const projects = projectsData?.projects || [];

  // Enrich projects with workspace metadata for search
  const enrichedProjects = useMemo(() => {
    return projects.map((p, i) => enrichProjectWithWorkspaceData(p, i));
  }, [projects]);

  // Search functionality (for use by the modal)
  const handleSearch = useCallback((query: string) => {
    if (!query.trim()) return { projects: [], subjects: [] };
    return searchWorkspace(enrichedProjects, mockSubjects, query);
  }, [enrichedProjects]);


  // Favorite projects (from enriched data)
  const favoriteProjects = enrichedProjects.filter(p => p.isFavorite);

  // Debugging
  console.log(`[DEBUG] Sidebar - currentOrgId: ${currentOrgId}`);

  const handleSubjectClick = (subjectId: string) => {
    setSearchQuery("");
    setShowSearchResults(false);
    // Navigate to projects page and scroll to subject
    router.push(`/org/${currentOrgId}/projects#subject-${subjectId}`);
  };

  const handleProjectClick = (projectId: string) => {
    setSearchQuery("");
    setShowSearchResults(false);
    const proj = projects.find(p => p.id === projectId);
    if (proj) {
      router.push(`/org/${currentOrgId}/projects/${projectId}/graph`);
    }
  };

  // Group enriched projects by subject for sidebar display
  const sidebarGroupedProjects = useMemo(() => {
    const grouped = new Map<string, any[]>();
    const realSubjects = subjectsData?.subjects || [];
    const allKnownSubjects = realSubjects.length > 0
      ? realSubjects
      : mockSubjects;

    allKnownSubjects.forEach(s => grouped.set(s.id, []));
    grouped.set("unfiled", []);

    enrichedProjects.forEach(p => {
      const subjectId = p.subjectId || "unfiled";
      const existing = grouped.get(subjectId) || [];
      grouped.set(subjectId, [...existing, p]);
    });

    return {
      subjects: allKnownSubjects,
      grouped
    };
  }, [enrichedProjects, subjectsData?.subjects]);

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

      {/* Search Button (Triggers Modal) */}
      <div className="px-3 py-2">
        <button
          onClick={() => setIsSearchModalOpen(true)}
          className="w-full flex items-center justify-between px-2.5 h-9 rounded-md bg-[#2c2d31] border border-[#3b3c40] text-[#7b7c7e] hover:text-[#d1d2d5] transition-all group shadow-inner"
        >
          <div className="flex items-center gap-2.5">
            <SearchIcon className="h-4 w-4 transition-colors group-hover:text-white" />
            <span className="text-[13px] font-medium">Search...</span>
          </div>
          <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-[#3b3c40] border border-[#4c4d52] text-[10px] font-bold text-[#d1d2d5]">
            <span className="opacity-60">⌘</span>
            <span>K</span>
          </div>
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-4 custom-scrollbar">
        {currentOrgId && currentOrgId !== "undefined" ? (
          <>
            <div className="space-y-0.5">
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

            <div className="px-3 mb-2 flex items-center justify-between group">
              <div className="text-[11px] font-bold text-[#7b7c7e] uppercase tracking-wider">Subjects</div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-[#2c2d31] rounded">
                    <Plus className="h-3.5 w-3.5 text-[#7b7c7e]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 bg-[#1a1b1e] border-[#2c2d31] text-[#d1d2d5] p-1.5" align="start" side="right" sideOffset={10}>
                  <DropdownMenuItem
                    className="focus:bg-[#2c2d31] focus:text-white cursor-pointer py-3 px-3 rounded-md transition-colors"
                    onClick={() => setIsSubjectModalOpen(true)}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-blue-400" />
                        <span className="text-[14px] font-bold text-white">Subject</span>
                      </div>
                      <span className="text-[11px] text-[#7b7c7e] leading-tight pl-6">Create a new organizational divider</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#2c2d31] my-1" />
                  <DropdownMenuItem asChild className="focus:bg-[#2c2d31] focus:text-white cursor-pointer py-2.5 px-3 rounded-md transition-colors">
                    <Link href={`/org/${currentOrgId}/projects/new`} className="flex items-center w-full">
                      <FolderKanban className="h-4 w-4 mr-2 text-[#7b7c7e]" />
                      <span className="text-[13px] font-medium">Project</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-4">
              {sidebarGroupedProjects.subjects.map((subject) => {
                const subjectProjects = sidebarGroupedProjects.grouped.get(subject.id) || [];
                if (subjectProjects.length === 0) return null;

                return (
                  <div key={subject.id} className="space-y-0.5">
                    <div className="px-3 py-1 flex items-center gap-2 text-[10px] font-bold text-[#7b7c7e]/60 uppercase tracking-widest border-b border-[#2c2d31]/30 mb-1">
                      <div className="w-1 h-1 rounded-full" style={{ backgroundColor: subject.color }} />
                      {subject.name}
                    </div>
                    {subjectProjects.map((project) => (
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
                  </div>
                );
              })}

              {/* Unfiled Projects */}
              {(sidebarGroupedProjects.grouped.get("unfiled") || []).length > 0 && (
                <div className="space-y-0.5">
                  <div className="px-3 py-1 text-[10px] font-bold text-[#7b7c7e]/60 uppercase tracking-widest border-b border-[#2c2d31]/30 mb-1">
                    Unfiled
                  </div>
                  {(sidebarGroupedProjects.grouped.get("unfiled") || []).map((project) => (
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
                </div>
              )}
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

      <SubjectCreationModal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        onCreated={handleCreateSubject}
      />

      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        orgId={currentOrgId}
        projects={enrichedProjects}
        subjects={mockSubjects}
        onSearch={handleSearch}
      />
    </div >
  );
}
