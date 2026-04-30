"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, FolderKanban } from "lucide-react";
import Link from "next/link";
import { WorkspaceTab, WorkspaceTabs } from "@/components/workspace/WorkspaceTabs";
import { FolderSection } from "@/components/workspace/FolderSection";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { useWorkspaceStructure, Folder, Project } from "@/hooks/use-workspace-structure";
import { useMoveItem } from "@/hooks/use-move-item";

function getAllProjects(folders: Folder[]): Project[] {
  let projects: Project[] = [];
  for (const folder of folders) {
    projects = [...projects, ...folder.projects, ...getAllProjects(folder.children)];
  }
  return projects;
}

export default function OrgProjectsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgId = params.orgId as string;
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("all");

  // Unified Data Hook
  const { data: structure, isLoading } = useWorkspaceStructure(orgId);
  const { mutate: moveItem } = useMoveItem();

  // Show welcome toast when joining via invite
  useEffect(() => {
    if (searchParams.get("welcome") === "1") {
      toast.success("Welcome to the workspace!", {
        description: "You've successfully joined this workspace.",
      });
      // Clean up URL
      window.history.replaceState({}, "", `/org/${orgId}/projects`);
    }
  }, [searchParams, orgId]);

  const allProjectsRaw = useMemo(() => {
    if (!structure) return [];
    return [...(structure.root.unfiledProjects || []), ...getAllProjects(structure.root.folders || [])];
  }, [structure]);

  const filteredProjects = useMemo(() => {
    const sortedByUpdated = [...allProjectsRaw].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    if (activeTab === "recents") {
      return sortedByUpdated.slice(0, 12);
    }

    if (activeTab === "favorites") {
      return sortedByUpdated.filter((project) => project.isFavorite);
    }

    if (activeTab === "unfiled") {
      return structure?.root.unfiledProjects || [];
    }

    return allProjectsRaw;
  }, [activeTab, allProjectsRaw, structure?.root.unfiledProjects]);

  // Handle Drag End
  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // Moving a Project
    if (type === "PROJECT") {
      const destFolderId = destination.droppableId === "unfiled" ? null : destination.droppableId;

      // Find the target lists to calculate new sortOrder
      // We need to find the list of projects in the destination folder
      // AND the sortOrder of neighbors at destination.index

      // Helper to find projects by folderId
      const findProjectsInFolder = (fid: string | null): Project[] => {
        if (fid === null) return structure?.root.unfiledProjects || [];
        // Recursive find folder
        const findF = (folders: Folder[]): Folder | null => {
          for (const f of folders) {
            if (f.id === fid) return f;
            const found = findF(f.children);
            if (found) return found;
          }
          return null;
        }
        const folder = findF(structure?.root.folders || []);
        return folder ? folder.projects : [];
      };

      const destProjects = findProjectsInFolder(destFolderId);

      // Calculate new sortOrder
      // destProjects is ordered by sortOrder (asc) from API? Yes.
      // But drag result index is based on the *rendered* list.
      // Assuming the rendered list matches structure order.

      // Note: If we drag within same list, destProjects includes the moved item at old index.
      // If different list, it doesn't.
      // This makes index calc tricky without modifying list first.

      // Simplified Logic: 
      // 1. Get ordered list of projects at destination (excluding the moved item if it was already there?)
      // Actually, 'destProjects' contains the state BEFORE the move.

      let prevOrder = 0;
      let nextOrder = 0;

      // Remove source item from calculation context if same list is targeted
      const cleanDestProjects = destProjects.filter(p => p.id !== result.draggableId);

      if (cleanDestProjects.length === 0) {
        // Empty list
        prevOrder = 1000;
        nextOrder = 2000;
      } else if (destination.index === 0) {
        // Top of list
        nextOrder = cleanDestProjects[0].sortOrder;
        prevOrder = nextOrder - 1000;
      } else if (destination.index >= cleanDestProjects.length) {
        // End of list
        prevOrder = cleanDestProjects[cleanDestProjects.length - 1].sortOrder;
        nextOrder = prevOrder + 1000;
      } else {
        // In between
        prevOrder = cleanDestProjects[destination.index - 1].sortOrder;
        nextOrder = cleanDestProjects[destination.index].sortOrder;
      }

      const newSortOrder = (prevOrder + nextOrder) / 2;

      moveItem({
        orgId,
        itemType: "PROJECT",
        itemId: result.draggableId,
        destinationParentId: destFolderId,
        newSortOrder
      });

      toast.info("Moving project...");
    }

    // Handle Folder Move (if type === SUBJECT/FOLDER)
    // Not implemented in UI drag handle yet, but logic would be similar
  };

  // Calculate tab counts
  const tabCounts = useMemo(() => {
    return {
      all: allProjectsRaw.length,
      recents: Math.min(allProjectsRaw.length, 12),
      favorites: allProjectsRaw.filter((project) => project.isFavorite).length,
      unfiled: structure?.root.unfiledProjects?.length || 0,
    };
  }, [allProjectsRaw, structure?.root.unfiledProjects]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading workspace...</div>
      </div>
    );
  }

  // Recursive Renderer for Folder Sections
  const renderFolderSection = (folder: Folder) => {
    // If we are filtering (e.g. Favorites tab), we might show projects even if they are deep.
    // But typically filtering flattens the view.
    // "All Projects" tab preserves hierarchy. Others flatten.

    if (activeTab !== "all") return null;

    return (
      <div key={folder.id}>
        <FolderSection
          folder={folder}
          projects={folder.projects}
          orgId={orgId}
          isDropZone={true}
        />
        {/* Render Children (Nested Folders) with indentation */}
        {folder.children.length > 0 && (
          <div className="pl-6 border-l border-border/50 ml-2 mt-2">
            {folder.children.map(renderFolderSection)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Projects</h1>
        <Button asChild>
          <Link href={`/org/${orgId}/projects/new`}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Workspace Tabs */}
      <WorkspaceTabs activeTab={activeTab} onTabChange={setActiveTab} counts={tabCounts} />

      {/* Drag Drop Context */}
      <DragDropContext onDragEnd={onDragEnd}>
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>
              {activeTab === "all"
                ? "No projects yet. Create your first project to get started."
                : `No projects in ${activeTab}.`}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 
                Scenario A: 'All' Tab -> Hierarchy View 
                Scenario B: Filtered Tab -> Flat View 
            */}

            {activeTab === "all" ? (
              <>
                {/* Folders & Projects Tree */}
                {(structure?.root?.folders || []).map(renderFolderSection)}

                {/* Unfiled Projects */}
                {(structure?.root?.unfiledProjects?.length ?? 0) > 0 && (
                  <FolderSection
                    folder={{
                      id: "unfiled",
                      name: "Unfiled",
                      description: "Projects without a folder",
                      color: "#9ca3af",
                      orgId,
                      parentId: null,
                      sortOrder: 0,
                      children: [],
                      projects: structure?.root?.unfiledProjects ?? [],
                    }}
                    projects={structure?.root?.unfiledProjects ?? []}
                    orgId={orgId}
                    isDropZone={true}
                  />
                )}
              </>
            ) : (
              /* Flat List for filtered tabs */
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <FolderSection
                  folder={{
                    id: activeTab,
                    name: activeTab.charAt(0).toUpperCase() + activeTab.slice(1),
                    description: "",
                    color: "transparent",
                    orgId,
                    parentId: null,
                    sortOrder: 0,
                    children: [],
                    projects: filteredProjects,
                  }}
                  projects={filteredProjects}
                  orgId={orgId}
                  isDropZone={false}
                />
              </div>
            )}
          </div>
        )}
      </DragDropContext>
    </div>
  );
}
