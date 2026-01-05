"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  LogOut,
  UserCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FolderCreationModal } from "@/components/workspace/FolderCreationModal";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { toast } from "sonner";
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import { useWorkspaceStructure, Folder, Project } from "@/hooks/use-workspace-structure";
import { FolderTreeItem, ProjectTreeItem } from "./FolderTreeItem";
import { useMoveItem } from "@/hooks/use-move-item";

interface Workspace {
  orgId: string;
  name: string;
  hasUnreadInbox: boolean;
  unreadCount?: number;
  status?: string;
}

interface SidebarProps {
  currentOrgId: string;
}

export function Sidebar({ currentOrgId }: SidebarProps) {
  const { data: session } = useSession();
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();

  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [targetParentId, setTargetParentId] = useState<string | undefined>(undefined);
  const [sidebarWidth, setSidebarWidth] = useState(280); // Default: 280px (increased from 256px)
  const [isResizing, setIsResizing] = useState(false);

  const initials = session?.user?.name
    ?.split("")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  // Fetch workspaces
  const { data: workspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const res = await fetch("/api/workspaces");
      if (!res.ok) throw new Error("Failed to fetch workspaces");
      return res.json() as Promise<Workspace[]>;
    },
  });

  // Unified Workspace Structure
  const { data: structure, isLoading } = useWorkspaceStructure(currentOrgId);
  const { mutate: moveItem } = useMoveItem();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (workspaces && workspaces.length > 0) {
      if (!currentOrgId || currentOrgId === "undefined") {
        router.push(`/org/${workspaces[0].orgId}/projects`);
        return;
      }
      const isValid = workspaces.some(w => w.orgId === currentOrgId);
      if (!isValid) {
        router.push(`/org/${workspaces[0].orgId}/projects`);
      }
    }
  }, [currentOrgId, workspaces, router]);

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

  // Load sidebar width from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('sidebarWidth');
    if (stored) {
      const width = parseInt(stored);
      if (width >= 200 && width <= 400) {
        setSidebarWidth(width);
      }
    }
  }, []);

  // Handle sidebar resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(400, Math.max(200, e.clientX));
      setSidebarWidth(newWidth);
      localStorage.setItem('sidebarWidth', newWidth.toString());
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleCreateFolder = async (name: string) => {
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: currentOrgId, name, parentId: targetParentId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create folder");
      }

      queryClient.invalidateQueries({ queryKey: ["workspace-structure", currentOrgId] });
      queryClient.invalidateQueries({ queryKey: ["folders", currentOrgId] });
      toast.success("Folder created");
      setIsFolderModalOpen(false);
      setTargetParentId(undefined);
    } catch (error: any) {
      console.error("Failed to create folder:", error);
      toast.error(error.message || "Failed to create folder");
    }
  };

  const openCreateFolderModal = (parentId?: string) => {
    setTargetParentId(parentId);
    setIsFolderModalOpen(true);
  };

  const handleSearch = useCallback((query: string) => {
    if (!query.trim()) return { projects: [], folders: [] };
    return { projects: [], folders: [] };
  }, []);

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // Identify Item Type
    let isFolder = false;
    const findItemType = (folders: Folder[]): "FOLDER" | "PROJECT" | null => {
      for (const f of folders) {
        if (f.id === draggableId) return "FOLDER";
        if (f.projects.some(p => p.id === draggableId)) return "PROJECT";
        const found = findItemType(f.children);
        if (found) return found;
      }
      return null;
    };

    if (structure?.root.unfiledProjects.some(p => p.id === draggableId)) {
      isFolder = false;
    } else {
      // If structure is loading or something, this might be partial?
      // We rely on structure being present.
      const type = findItemType(structure?.root.folders || []);
      // Default to false (project) if not found? Or return?
      // If we can't find it, we can't move it safely.
      if (!type) {
        console.warn("Could not find item type for", draggableId);
        return;
      }
      isFolder = type === "FOLDER";
    }

    // Identify Destination
    let destFolderId: string | null = null;
    let destProjects: Project[] = [];
    let destFolders: Folder[] = [];

    if (destination.droppableId === "unfiled") {
      destFolderId = null;
      destProjects = structure?.root.unfiledProjects || [];
    } else if (destination.droppableId === "sidebar-root") {
      destFolderId = null;
      destFolders = structure?.root.folders || [];
    } else {
      destFolderId = destination.droppableId;
      const findF = (folders: Folder[]): Folder | null => {
        for (const f of folders) {
          if (f.id === destFolderId) return f;
          const found = findF(f.children);
          if (found) return found;
        }
        return null;
      }
      const folder = findF(structure?.root.folders || []);
      if (folder) {
        destProjects = folder.projects;
        destFolders = folder.children;
      } else {
        // Target folder not found (maybe just deleted?)
        console.warn("Target folder not found", destFolderId);
        return;
      }
    }

    // Validate: Cannot drop folder into its own descendant or itself
    if (isFolder && destFolderId === draggableId) return;

    let listToUse: any[] = isFolder ? destFolders : destProjects;
    let targetIndex = destination.index;

    // Adjust index logic for mixed lists
    // In the Droppable, Folders come FIRST, then Projects.
    // If we drop a PROJECT, the visual index provided by DnD includes the count of folders above it.
    // So relative index in `destProjects` is `destination.index - destFolders.length`.
    if (!isFolder && destFolderId !== null) {
      // Inside a folder, we have children (folders) then projects.
      // Note: destFolders.length here refers to the target folder's children.
      // If we drop at index 0 (top of folder), and there are 2 subfolders.
      // We want it to be the first PROJECT.
      // DnD says index 0. 
      // If we use index 0 in `destProjects`, it becomes the first project. Correct.
      // BUT wait. If DnD says index 0, it means visually ABOVE the subfolders.
      // Our renderer FORCES projects to be below folders.
      // So even if we save it as "first project", it will render after "last folder".
      // This is a UI constraint.
      // But calculating the SortOrder needs to be correct relative to PROJECTS.

      // If I drop at index = (num_folders + 2), I am dropping at 3rd project position.
      // The index I get is (num_folders + 2).
      // So I subtract num_folders to get index 2.

      // What if I drop at index 0 (top)?
      // Index = 0.
      // 0 - num_folders. If num_folders = 2.
      // Result -2. 
      // Clamping to 0 fixes this -> becomes 0 (first project).
      // So visually it jumps down to start of projects list. This is acceptable/expected for enforced grouping.

      targetIndex = Math.max(0, targetIndex - destFolders.length);
    }
    // Note: At root level, we have separate Droppables ("sidebar-root" and "unfiled"), 
    // so we don't need this adjustment for root items if they are strictly separated.
    // But in Sidebar.tsx we separate them:
    // <Droppable droppableId="sidebar-root"> renders folders.
    // <Droppable droppableId="unfiled"> renders projects.
    // So at root, index is pure.

    // We only need adjustment if we are in a nested folder (destFolderId !== null).

    // Remove self from listToUse
    const filteredList = listToUse.filter(i => i.id !== draggableId);

    let prevOrder = 0;
    let nextOrder = 0;

    // Clamp targetIndex
    targetIndex = Math.max(0, Math.min(targetIndex, filteredList.length));

    if (filteredList.length === 0) {
      prevOrder = 1000;
      nextOrder = 2000;
    } else if (targetIndex === 0) {
      nextOrder = filteredList[0].sortOrder;
      prevOrder = nextOrder - 1000;
    } else if (targetIndex >= filteredList.length) {
      prevOrder = filteredList[filteredList.length - 1].sortOrder;
      nextOrder = prevOrder + 1000;
    } else {
      prevOrder = filteredList[targetIndex - 1].sortOrder;
      nextOrder = filteredList[targetIndex].sortOrder;
    }

    const newSortOrder = (prevOrder + nextOrder) / 2;

    moveItem({
      orgId: currentOrgId,
      itemType: isFolder ? "FOLDER" : "PROJECT",
      itemId: draggableId,
      destinationParentId: destFolderId,
      newSortOrder
    });

    toast.info(isFolder ? "Moving folder..." : "Moving project...");
  };

  const currentWorkspace = workspaces?.find((w) => w.orgId === currentOrgId);

  const NavItem = ({ href, icon: Icon, label, active, count }: any) => (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
        active
          ? "bg-[#2c2d31] text-white"
          : "text-[#9ca3af] hover:bg-[#2c2d31]/50 hover:text-[#e5e7eb]"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="px-1.5 py-0.5 min-w-[1.25rem] text-center text-xs font-semibold rounded-full bg-blue-500 text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );

  return (
    <div className="relative flex h-screen flex-col border-r border-[#2c2d31] bg-[#1a1b1e]" style={{ width: `${sidebarWidth}px` }}>
      {/* Workspace Header */}
      <div className="h-14 flex items-center px-4 border-b border-[#2c2d31]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between gap-2 px-0 hover:bg-transparent"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-600 text-[10px] font-bold text-white">
                  {currentWorkspace?.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate font-semibold text-white">
                  {currentWorkspace?.name || "Loading..."}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-[#6b7280]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px] bg-[#1f2023] border-[#2c2d31] text-white">
            {workspaces?.map((w) => (
              <DropdownMenuItem
                key={w.orgId}
                onSelect={() => {
                  // Preserve navigation context when switching workspace
                  let targetPath = `/org/${w.orgId}/home`;
                  if (pathname?.includes("/inbox")) {
                    targetPath = `/org/${w.orgId}/inbox`;
                  } else if (pathname?.includes("/projects")) {
                    targetPath = `/org/${w.orgId}/projects`;
                  } else if (pathname?.includes("/home")) {
                    targetPath = `/org/${w.orgId}/home`;
                  }
                  router.push(targetPath);
                }}
                className="gap-2 focus:bg-[#2c2d31] focus:text-white cursor-pointer"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded bg-zinc-700 text-[10px]">
                  {w.name.charAt(0)}
                </div>
                {w.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-[#2c2d31]" />
            <DropdownMenuItem className="gap-2 focus:bg-[#2c2d31] focus:text-white cursor-pointer">
              <Plus className="h-4 w-4" /> Create Workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1 py-4">
        <div className="px-3 space-y-1">
          {/* SEARCH */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground mb-6 h-9 px-2"
            onClick={() => setIsSearchModalOpen(true)}
          >
            <SearchIcon className="h-4 w-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-[#4b5563] bg-[#2c2d31] px-1.5 font-mono text-[10px] font-medium text-[#9ca3af] opacity-50">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>

          <div className="space-y-1">
            <NavItem
              href={`/org/${currentOrgId}/home`}
              icon={Home}
              label="Home"
              active={pathname?.includes("/home")}
            />
            <NavItem
              href={`/org/${currentOrgId}/inbox`}
              icon={Inbox}
              label="Inbox"
              active={pathname?.includes("/inbox")}
              count={currentWorkspace?.unreadCount}
            />
            <NavItem
              href={`/org/${currentOrgId}/projects`}
              icon={FolderKanban}
              label="Projects"
              active={pathname?.includes("/projects")}
            />
          </div>

          <div className="pt-6">
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider">
                Projects
              </h3>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 text-[#6b7280] hover:text-[#e5e7eb] hover:bg-transparent"
                  onClick={() => router.push(`/org/${currentOrgId}/projects/new`)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 text-[#6b7280] hover:text-[#e5e7eb] hover:bg-transparent"
                  onClick={() => openCreateFolderModal(undefined)}
                >
                  <FolderKanban className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
              <div className="px-1 space-y-0.5" id="sidebar-projects-list">
                {isLoading ? (
                  <div className="space-y-2 px-2">
                    {/* Skeleton folder items */}
                    <div className="flex items-center gap-2 py-1.5 px-2">
                      <div className="h-3 w-3 bg-[#2c2d31] rounded animate-pulse" />
                      <div className="h-3.5 w-3.5 bg-[#2c2d31] rounded animate-pulse" />
                      <div className="h-3 flex-1 bg-[#2c2d31] rounded animate-pulse" />
                    </div>
                    <div className="flex items-center gap-2 py-1.5 px-2">
                      <div className="h-3 w-3 bg-[#2c2d31] rounded animate-pulse" />
                      <div className="h-3.5 w-3.5 bg-[#2c2d31] rounded animate-pulse" />
                      <div className="h-3 w-24 bg-[#2c2d31] rounded animate-pulse" />
                    </div>
                    <div className="flex items-center gap-2 py-1.5 px-2 pl-6">
                      <div className="h-4 w-4 bg-[#2c2d31] rounded animate-pulse" />
                      <div className="h-3 w-32 bg-[#2c2d31] rounded animate-pulse" />
                    </div>
                  </div>
                ) : (
                  <>
                    <Droppable droppableId="sidebar-root" type="SIDEBAR_ITEM">
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn("min-h-[4px] transition-all duration-150 relative", snapshot.isDraggingOver && "before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-blue-500 before:rounded-full")}
                        >
                          {structure?.root.folders.map((folder, index) => (
                            <FolderTreeItem
                              key={folder.id}
                              folder={folder}
                              orgId={currentOrgId}
                              onCreateSubFolder={openCreateFolderModal}
                              index={index}
                            />
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>

                    <Droppable droppableId="unfiled" type="SIDEBAR_ITEM">
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn("min-h-[8px] mt-2 transition-all duration-150 relative", snapshot.isDraggingOver && "before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-blue-500 before:rounded-full")}
                        >
                          {structure?.root.unfiledProjects.map((project, index) => (
                            <ProjectTreeItem
                              key={project.id}
                              project={project}
                              orgId={currentOrgId}
                              level={0}
                              index={index}
                            />
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>

                    {!isLoading &&
                      structure?.root.folders.length === 0 &&
                      structure?.root.unfiledProjects.length === 0 && (
                        <div className="px-3 py-6 text-center">
                          <FolderKanban className="h-8 w-8 mx-auto text-[#3b3c40] mb-2" />
                          <p className="text-xs text-[#6b7280]">No projects yet</p>
                          <p className="text-[10px] text-[#4b5563] mt-1">
                            Click + to create one
                          </p>
                        </div>
                      )}
                  </>
                )}
              </div>
            </DragDropContext>
          </div>
        </div>
      </ScrollArea>

      {/* User Footer */}
      <div className="p-3 border-t border-[#2c2d31]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 px-2 hover:bg-[#2c2d31]">
              <Avatar className="h-6 w-6">
                <AvatarImage src={session?.user?.image || ""} />
                <AvatarFallback className="bg-blue-600 text-[10px] text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-sm font-medium text-white truncate">
                  {session?.user?.name}
                </p>
              </div>
              <Settings className="h-4 w-4 text-[#6b7280]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-[#1f2023] border-[#2c2d31] text-white">
            <DropdownMenuItem
              className="gap-2 focus:bg-[#2c2d31] focus:text-white cursor-pointer"
              onClick={() => router.push("/settings/profile")}
            >
              <UserCircle2 className="h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 focus:bg-[#2c2d31] focus:text-white cursor-pointer"
              onClick={() => router.push(`/org/${currentOrgId}/settings`)}
            >
              <Settings className="h-4 w-4" /> Workspace Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#2c2d31]" />
            <DropdownMenuItem
              className="gap-2 text-red-400 focus:bg-[#2c2d31] focus:text-red-400 cursor-pointer"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <FolderCreationModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        onSubmit={handleCreateFolder}
      />

      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSearch={handleSearch}
        orgId={currentOrgId}
        onSelect={() => { }}
      />

      {/* Resize Handle */}
      <div
        className={cn(
          "absolute top-0 right-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500/50 transition-colors group",
          isResizing && "bg-blue-500"
        )}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
      >
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1 h-12 bg-slate-600 rounded-l opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}