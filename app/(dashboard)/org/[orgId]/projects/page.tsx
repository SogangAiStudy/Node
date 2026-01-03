"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, FolderKanban } from "lucide-react";
import Link from "next/link";
import { WorkspaceTabs } from "@/components/workspace/WorkspaceTabs";
import { FolderSection } from "@/components/workspace/FolderSection";
import { ProjectDTO } from "@/types";
import {
  WorkspaceTab,
  enrichProjectWithWorkspaceData,
  filterProjectsByTab,
} from "@/lib/mock-workspace-data";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { useWorkspaceStructure, Folder, Project } from "@/hooks/use-workspace-structure";
import { useMoveItem } from "@/hooks/use-move-item";

export default function OrgProjectsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("all");
  const queryClient = useQueryClient();

  // Unified Data Hook
  const { data: structure, isLoading } = useWorkspaceStructure(orgId);
  const { mutate: moveItem } = useMoveItem();

  // Flatten all projects for "All Projects" / Filter logic
  // Recursive function to gather all projects from tree
  const getAllProjects = (folders: Folder[]): Project[] => {
    let projects: Project[] = [];
    for (const f of folders) {
      projects = [...projects, ...f.projects, ...getAllProjects(f.children)];
    }
    return projects;
  };

  const allProjectsRaw = useMemo(() => {
    if (!structure) return [];
    return [...(structure.root.unfiledProjects || []), ...getAllProjects(structure.root.folders || [])];
  }, [structure]);

  // Enrich with current logic (add lastUpdated text etc)
  // Logic from mock-workspace-data expects simple object
  const enrichedProjects = useMemo(() => {
    return allProjectsRaw.map((project, index) =>
      enrichProjectWithWorkspaceData(project as any, index)
    );
  }, [allProjectsRaw]);

  // Filter projects by active tab
  const filteredProjects = useMemo(() => {
    return filterProjectsByTab(enrichedProjects, activeTab);
  }, [enrichedProjects, activeTab]);

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
      all: enrichedProjects.length,
      recents: filterProjectsByTab(enrichedProjects, "recents").length,
      favorites: filterProjectsByTab(enrichedProjects, "favorites").length,
      unfiled: filterProjectsByTab(enrichedProjects, "unfiled").length,
    };
  }, [enrichedProjects]);

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
          folder={folder as any} // Cast due to missing projectIds, handled by UI logic
          projects={folder.projects as any[]}
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
                      projectIds: [],
                      isExpanded: true,
                    } as any}
                    projects={(structure?.root?.unfiledProjects ?? []) as any[]}
                    orgId={orgId}
                    isDropZone={true}
                  />
                )}
              </>
            ) : (
              /* Flat List for filtered tabs */
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.map((project) => (
                  // Using ProjectCard directly or a wrapper?
                  // Current design uses SubjectSection for layout. 
                  // Flat list should probably use ProjectCard directly.
                  // But imported `SubjectSection` uses `ProjectCard` internally.
                  // I'll assume we can use `ProjectCard` if I import it, or just use a dummy Unfiled section to hold them all.
                  // Dummy section is easiest for filtering layout consistency.
                  <FolderSection
                    key="filtered"
                    folder={{
                      id: activeTab,
                      name: activeTab.charAt(0).toUpperCase() + activeTab.slice(1),
                      description: "",
                      color: "transparent",
                      projectIds: [],
                      isExpanded: true
                    } as any}
                    projects={filteredProjects as any[]}
                    orgId={orgId}
                    isDropZone={false} // No D&D in filtered view usually
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </DragDropContext>
    </div>
  );
}
