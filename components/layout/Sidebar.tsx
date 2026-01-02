"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Star,
  GripVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockSubjects, searchWorkspace, enrichProjectWithWorkspaceData } from "@/lib/mock-workspace-data";
import { SubjectCreationModal } from "@/components/workspace/SubjectCreationModal";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { ProjectDTO } from "@/types";

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
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);

  // Local state for DnD
  const [localGroupedProjects, setLocalGroupedProjects] = useState<Map<string, any[]>>(new Map());

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
        // Use window.location for hard redirect if needed, but router.push is better for SPA
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

  // Reorder Subjects Mutation
  const reorderSubjectsMutation = useMutation({
    mutationFn: async (items: { id: string; order: number }[]) => {
      await fetch("/api/subjects/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: currentOrgId, items }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects", currentOrgId] });
      toast.success("Subject order updated");
    },
  });

  // Reorder/Move Projects Mutation
  const reorderProjectsMutation = useMutation({
    mutationFn: async (items: { id: string; order: number; subjectId?: string | null }[]) => {
      await fetch("/api/projects/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: currentOrgId, items }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", currentOrgId] });
      toast.success("Project updated");
    },
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
  const projects = useMemo(() => projectsData?.projects || [], [projectsData]);

  // Enrich projects with workspace metadata for search
  const enrichedProjects = useMemo(() => {
    return projects.map((p, i) => enrichProjectWithWorkspaceData(p, i));
  }, [projects]);

  console.log("Sidebar Debug: OrgId", currentOrgId);
  console.log("Sidebar Debug: Projects Raw", projects);
  console.log("Sidebar Debug: Subjects Raw", subjectsData?.subjects);
  console.log("Sidebar Debug: Enriched Projects", enrichedProjects);

  // Search functionality (for use by the modal)
  const handleSearch = useCallback((query: string) => {
    if (!query.trim()) return { projects: [], subjects: [] };
    return searchWorkspace(enrichedProjects, mockSubjects, query);
  }, [enrichedProjects]);


  // Favorite projects (from enriched data)
  const favoriteProjects = enrichedProjects.filter(p => p.isFavorite);


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
    const allKnownSubjects = subjectsData?.subjects || [];

    allKnownSubjects.forEach(s => grouped.set(s.id, []));
    grouped.set("unfiled", []);

    enrichedProjects.forEach(p => {
      const subjectId = p.subjectId || "unfiled";
      // If we have a subject ID that isn't in our list (e.g. mock data or deleted), 
      // put it in unfiled instead of crashing or ignoring it.
      if (subjectId !== "unfiled" && !grouped.has(subjectId)) {
        const unfiled = grouped.get("unfiled") || [];
        grouped.set("unfiled", [...unfiled, p]);
      } else {
        const existing = grouped.get(subjectId) || [];
        grouped.set(subjectId, [...existing, p]);
      }
    });

    console.log("Sidebar Debug: Grouped", {
      subjectsCount: allKnownSubjects.length,
      unfiledCount: grouped.get("unfiled")?.length,
      keys: Array.from(grouped.keys())
    });

    return {
      subjects: allKnownSubjects,
      grouped
    };
  }, [enrichedProjects, subjectsData]);

  // Keep local state in sync
  useEffect(() => {
    setLocalGroupedProjects(sidebarGroupedProjects.grouped);
  }, [sidebarGroupedProjects]);


  // Handle Drag End for Sidebar
  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;

    if (!destination) return;

    // 1. Reordering Subjects
    if (type === "SUBJECT") {
      // For subjects, we might not render them all as draggable in this simplified sidebar, 
      // but if we did, logic would go here. The text says "subjects be shown in sidebar", 
      // which imply reordering. 
      // However, subjectsData returns sorted array.
      // We will implement Draggable for the subject headers in the render loop.
      const newSubjects = Array.from(sidebarGroupedProjects.subjects);
      const [removed] = newSubjects.splice(source.index, 1);
      newSubjects.splice(destination.index, 0, removed);

      const updates = newSubjects.map((s, index) => ({
        id: s.id,
        order: index,
      }));
      reorderSubjectsMutation.mutate(updates);
      return;
    }

    // 2. Reordering Projects
    if (type === "PROJECT") {
      const sourceSubjectId = source.droppableId;
      const destSubjectId = destination.droppableId;

      const sourceList = localGroupedProjects.get(sourceSubjectId) || [];
      const destList = localGroupedProjects.get(destSubjectId) || [];

      if (sourceSubjectId === destSubjectId) {
        const newList = Array.from(sourceList);
        const [removed] = newList.splice(source.index, 1);
        newList.splice(destination.index, 0, removed);

        const newGrouped = new Map(localGroupedProjects);
        newGrouped.set(sourceSubjectId, newList);
        setLocalGroupedProjects(newGrouped);

        const updates = newList.map((p, index) => ({
          id: p.id,
          order: index,
          subjectId: sourceSubjectId === "unfiled" ? null : sourceSubjectId,
        }));
        reorderProjectsMutation.mutate(updates);

      } else {
        const newSourceList = Array.from(sourceList);
        const [removed] = newSourceList.splice(source.index, 1);
        const newDestList = Array.from(destList);
        newDestList.splice(destination.index, 0, removed);

        const newGrouped = new Map(localGroupedProjects);
        newGrouped.set(sourceSubjectId, newSourceList);
        newGrouped.set(destSubjectId, newDestList);
        setLocalGroupedProjects(newGrouped);

        const updates = newDestList.map((p, index) => ({
          id: p.id,
          order: index,
          subjectId: destSubjectId === "unfiled" ? null : destSubjectId,
        }));
        reorderProjectsMutation.mutate(updates);
      }
    }
  };


  const NavItem = ({
    href,
    icon: Icon,
    label,
    active,
    hasIndicator,
    onClick,
  }: {
    href: string;
    icon: any;
    label: string;
    active?: boolean;
    hasIndicator?: boolean;
    onClick?: () => void;
  }) => (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-[14px] transition-colors relative group",
        active
          ? "bg-[#2c2d31] text-white font-medium"
          : "text-[#d1d2d5] hover:bg-[#2c2d31] hover:text-white"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100", active && "opacity-100 text-white")} />
      <span className="truncate">{label}</span>
      {hasIndicator && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500 shadow-glow" />
      )}
    </Link>
  );

  return (
    <div className="flex flex-col h-full bg-[#1a1b1e] text-[#d1d2d5] w-[260px] border-r border-[#2c2d31] flex-shrink-0">
      {/* Workspace Switcher */}
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-white bg-[#2c2d31]/50 hover:bg-[#2c2d31] rounded-lg transition-colors border border-[#2c2d31] group">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-white leading-none">
                    {currentWorkspace?.name?.[0]?.toUpperCase() || "W"}
                  </span>
                </div>
                <span className="truncate">{currentWorkspace?.name || "Select Workspace"}</span>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-white transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[236px] bg-[#1a1b1e] border-[#2c2d31] text-[#d1d2d5] p-1.5" align="start" sideOffset={8}>
            <div className="px-2 py-1.5 text-[11px] font-bold text-[#7b7c7e] uppercase tracking-wider">
              Switch Workspace
            </div>
            {workspaces?.map((workspace) => (
              <DropdownMenuItem
                key={workspace.orgId}
                asChild
                className={cn(
                  "focus:bg-[#2c2d31] focus:text-white cursor-pointer py-2 px-2 rounded-md transition-colors",
                  workspace.orgId === currentOrgId && "bg-[#2c2d31] text-white"
                )}
              >
                <Link href={`/org/${workspace.orgId}/projects`} className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-4 h-4 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-white leading-none">
                        {workspace.name?.[0]?.toUpperCase()}
                      </span>
                    </div>
                    <span className="truncate text-[13px]">{workspace.name}</span>
                  </div>
                  {workspace.hasUnreadInbox && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-glow" />
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-[#2c2d31] my-1" />
            <DropdownMenuItem asChild className="focus:bg-[#2c2d31] focus:text-white cursor-pointer py-2 px-2 rounded-md transition-colors">
              <Link href="/workspaces/new" className="flex items-center gap-2">
                <Plus className="h-4 w-4 mr-2" />
                New Workspace
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quick Actions / Search */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setIsSearchModalOpen(true)}
          className="flex items-center w-full px-3 py-1.5 text-[13px] text-[#7b7c7e] bg-[#000000]/20 hover:bg-[#000000]/40 border border-[#2c2d31] rounded-md transition-colors group"
        >
          <SearchIcon className="h-3.5 w-3.5 mr-2 group-hover:text-[#d1d2d5]" />
          <span className="group-hover:text-[#d1d2d5]">Search...</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-4 items-center gap-1 rounded border border-[#2c2d31] bg-[#2c2d31]/50 px-1.5 font-mono text-[10px] font-medium text-[#7b7c7e] opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 p-3 pt-0">
          {/* Main Navigation */}
          <div className="space-y-0.5">
            <NavItem
              href={`/org/${currentOrgId}/projects`}
              icon={Home}
              label="Home"
              active={pathname === `/org/${currentOrgId}/projects`}
            />
            <NavItem
              href={`/org/${currentOrgId}/inbox`}
              icon={Inbox}
              label="Inbox"
              active={pathname === `/org/${currentOrgId}/inbox`}
              hasIndicator={currentWorkspace?.hasUnreadInbox}
            />
          </div>

          <DragDropContext onDragEnd={onDragEnd}>
            {/* Subjects & Projects */}
            <div className="space-y-1">
              <div className="px-3 mb-2 flex items-center justify-between group">
                <div className="text-[11px] font-bold text-[#7b7c7e] uppercase tracking-wider">Projects</div>
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
                          <span className="text-[14px] font-bold text-white">Folder</span>
                        </div>
                        <span className="text-[11px] text-[#7b7c7e] leading-tight pl-6">Create a new folder to organize projects</span>
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

              {/* Droppable Area for Subjects */}
              <Droppable droppableId="sidebar-subjects" type="SUBJECT">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                    {sidebarGroupedProjects.subjects.map((subject, index) => {
                      const subjectProjects = localGroupedProjects.get(subject.id) || [];
                      if (subjectProjects.length === 0) return (
                        <Draggable key={subject.id} draggableId={subject.id} index={index}>
                          {(provided) =>
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                            // Drag handle on the header
                            >
                              <div {...provided.dragHandleProps} className="px-3 py-1 flex items-center gap-2 text-[10px] font-bold text-[#7b7c7e]/60 uppercase tracking-widest border-b border-[#2c2d31]/30 mb-1">
                                <div className="w-1 h-1 rounded-full" style={{ backgroundColor: subject.color }} />
                                {subject.name}
                              </div>
                              {/* Empty droppable for projects so we can drop into empty subject */}
                              <Droppable droppableId={subject.id} type="PROJECT">
                                {(provided) => (
                                  <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[10px]">
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            </div>
                          }
                        </Draggable>
                      );

                      return (
                        <Draggable key={subject.id} draggableId={subject.id} index={index}>
                          {(providedDrag) => (
                            <div ref={providedDrag.innerRef} {...providedDrag.draggableProps}>
                              <div
                                {...providedDrag.dragHandleProps}
                                className="px-3 py-1 flex items-center gap-2 text-[10px] font-bold text-[#7b7c7e]/60 uppercase tracking-widest border-b border-[#2c2d31]/30 mb-1 group-h"
                              >
                                <div className="w-1 h-1 rounded-full" style={{ backgroundColor: subject.color }} />
                                {subject.name}
                              </div>

                              <Droppable droppableId={subject.id} type="PROJECT">
                                {(providedDrop, snapshot) => (
                                  <div
                                    ref={providedDrop.innerRef}
                                    {...providedDrop.droppableProps}
                                    className={cn(snapshot.isDraggingOver && "bg-zinc-800/30 rounded")}
                                  >
                                    {subjectProjects.map((project: any, pIndex: number) => (
                                      <Draggable key={project.id} draggableId={project.id} index={pIndex}>
                                        {(providedP, snapshotP) => (
                                          <div
                                            ref={providedP.innerRef}
                                            {...providedP.draggableProps}
                                            {...providedP.dragHandleProps}
                                            style={{ ...providedP.draggableProps.style }}
                                          >
                                            <Link
                                              href={`/org/${currentOrgId}/projects/${project.id}/graph`}
                                              className={cn(
                                                "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-colors group",
                                                currentProjectId === project.id
                                                  ? "bg-[#2c2d31] text-white"
                                                  : "text-[#d1d2d5] hover:bg-[#2c2d31] hover:text-white",
                                                snapshotP.isDragging && "opacity-50"
                                              )}
                                            >
                                              <FolderKanban className={cn("h-4 w-4 shrink-0 opacity-60", currentProjectId === project.id && "opacity-100")} />
                                              <span className="truncate">{project.name}</span>
                                            </Link>
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                    {providedDrop.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {/* Unfiled Projects - Always visible as default drop zone */}
              <div className="space-y-0.5 mt-4">
                {/* Only show label if there are other folders, otherwise it looks redundant? 
                      Actually, keeping it consistent is safer. 
                      Let's call it "General" or keep "Unfiled" for now but make sure it renders. 
                  */}
                <div className="px-3 py-1 text-[10px] font-bold text-[#7b7c7e]/60 uppercase tracking-widest border-b border-[#2c2d31]/30 mb-1">
                  Unfiled
                </div>
                <Droppable droppableId="unfiled" type="PROJECT">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(snapshot.isDraggingOver && "bg-zinc-800/30 rounded")}
                    >
                      {(localGroupedProjects.get("unfiled") || []).map((project: any, index: number) => (
                        <Draggable key={project.id} draggableId={project.id} index={index}>
                          {(providedP) => (
                            <div
                              ref={providedP.innerRef}
                              {...providedP.draggableProps}
                              {...providedP.dragHandleProps}
                            >
                              <Link
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
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          </DragDropContext>

          {/* Favorites (Read Only for now, but could be draggable too) */}
          {favoriteProjects.length > 0 && (
            <div className="space-y-0.5 mt-4">
              <div className="px-3 py-1 text-[10px] font-bold text-[#7b7c7e]/60 uppercase tracking-widest border-b border-[#2c2d31]/30 mb-1">
                Favorites
              </div>
              {favoriteProjects.map((project) => (
                <Link
                  key={`fav-${project.id}`}
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
          )}
        </div>
      </ScrollArea>

      {/* User / Settings Footer */}
      <div className="p-3 border-t border-[#2c2d31] bg-[#1a1b1e]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full p-2 hover:bg-[#2c2d31] rounded-lg transition-colors group">
              <Avatar className="h-8 w-8 rounded-md border border-[#2c2d31]">
                <AvatarImage src={session?.user?.image || ""} />
                <AvatarFallback className="bg-[#2c2d31] text-white text-xs rounded-md">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start flex-1 overflow-hidden">
                <span className="text-[13px] font-medium text-white truncate w-full text-left">
                  {session?.user?.name || "User"}
                </span>
                <span className="text-[11px] text-[#7b7c7e] truncate w-full text-left">
                  {session?.user?.email}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-[#7b7c7e] group-hover:text-white transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-[#1a1b1e] border-[#2c2d31] text-[#d1d2d5] mb-2" align="start" side="top" sideOffset={8}>
            <div className="px-2 py-1.5 flex items-center gap-2">
              <Avatar className="h-8 w-8 rounded-md border border-[#2c2d31]">
                <AvatarImage src={session?.user?.image || ""} />
                <AvatarFallback className="bg-[#2c2d31] text-white text-xs rounded-md">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-white">
                  {session?.user?.name || "User"}
                </span>
                <span className="text-[11px] text-[#7b7c7e]">
                  {session?.user?.email}
                </span>
              </div>
            </div>
            <DropdownMenuSeparator className="bg-[#2c2d31] my-1" />
            <DropdownMenuItem asChild className="focus:bg-[#2c2d31] focus:text-white cursor-pointer">
              <Link href="/settings" className="flex items-center">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="focus:bg-[#2c2d31] focus:text-white cursor-pointer">
              <Link href={`/org/${currentOrgId}/settings/members`} className="flex items-center">
                <Users2 className="h-4 w-4 mr-2" />
                Members
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#2c2d31] my-1" />
            <DropdownMenuItem
              className="focus:bg-red-900/20 focus:text-red-400 text-red-500 cursor-pointer"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SubjectCreationModal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        onSubmit={handleCreateSubject}
      />

      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSearch={handleSearch}
        onSelect={(payload) => {
          if (payload.type === 'project') {
            router.push(`/org/${currentOrgId}/projects/${payload.id}/graph`);
          }
        }}
      />
    </div>
  );
}
