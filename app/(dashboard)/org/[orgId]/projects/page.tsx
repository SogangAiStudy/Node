"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, FolderKanban } from "lucide-react";
import Link from "next/link";
import { WorkspaceTabs } from "@/components/workspace/WorkspaceTabs";
import { SubjectSection } from "@/components/workspace/SubjectSection";
import { ProjectDTO } from "@/types";
import {
  WorkspaceTab,
  enrichProjectWithWorkspaceData,
  filterProjectsByTab,
  mockSubjects,
} from "@/lib/mock-workspace-data";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  description: string | null;
  primaryTeamName: string | null;
  createdAt: string;
  updatedAt: string;
  subjectId?: string | null;
  isFavorite?: boolean;
}

export default function OrgSubjectsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("all");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["projects", orgId],
    queryFn: async () => {
      const res = await fetch(`/api/projects?orgId=${orgId}`);
      if (!res.ok) throw new Error("Failed to fetch projects");
      const json = await res.json();
      return { projects: json.projects as Project[] };
    },
  });

  const { data: subjectsData, isLoading: isSubjectsLoading } = useQuery({
    queryKey: ["subjects", orgId],
    queryFn: async () => {
      const res = await fetch(`/api/subjects?orgId=${orgId}`);
      if (!res.ok) throw new Error("Failed to fetch subjects");
      const json = await res.json();
      return { subjects: json.subjects as any[] };
    },
  });

  // Reorder Subjects Mutation
  const reorderSubjectsMutation = useMutation({
    mutationFn: async (items: { id: string; order: number }[]) => {
      await fetch("/api/subjects/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, items }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects", orgId] });
      toast.success("Subject order updated");
    },
  });

  // Reorder/Move Projects Mutation
  const reorderProjectsMutation = useMutation({
    mutationFn: async (items: { id: string; order: number; subjectId?: string | null }[]) => {
      await fetch("/api/projects/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, items }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", orgId] });
      toast.success("Project updated");
    },
  });

  // Enrich projects with workspace metadata
  const enrichedProjects = useMemo(() => {
    if (!data?.projects) return [];
    return data.projects.map((project, index) =>
      enrichProjectWithWorkspaceData(project, index)
    );
  }, [data?.projects]);

  const allSubjects = useMemo(() => {
    const realSubjects = subjectsData?.subjects || [];
    // Only use mock subjects as a fallback
    return realSubjects.length > 0 ? realSubjects : [];
  }, [subjectsData?.subjects]);

  // Filter projects by active tab
  const filteredProjects = useMemo(() => {
    return filterProjectsByTab(enrichedProjects, activeTab);
  }, [enrichedProjects, activeTab]);

  // Group projects by subject - but for local state management during drag
  // We need to keep this stable for DnD
  const [groupedProjects, setGroupedProjects] = useState<Map<string, ProjectDTO[]>>(new Map());

  // Sync grouped projects when data changes
  useEffect(() => {
    const grouped = new Map<string, ProjectDTO[]>();
    allSubjects.forEach(s => grouped.set(s.id, []));
    grouped.set("unfiled", []);

    filteredProjects.forEach(p => {
      const subjectId = p.subjectId || "unfiled";
      const existing = grouped.get(subjectId) || [];
      // Only add if not already there (though filterProjectsByTab shouldn't duplicate)
      // Check if we need to initialize if map didn't have subject
      if (!grouped.has(subjectId)) {
        const unfiled = grouped.get("unfiled") || [];
        grouped.set("unfiled", [...unfiled, p as ProjectDTO]);
      } else {
        grouped.set(subjectId, [...existing, p as ProjectDTO]);
      }
    });
    setGroupedProjects(grouped);
  }, [filteredProjects, allSubjects]);


  // Handle Drag End
  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;

    if (!destination) return;

    // 1. Reordering Subjects
    if (type === "SUBJECT") {
      const newSubjects = Array.from(allSubjects);
      const [removed] = newSubjects.splice(source.index, 1);
      newSubjects.splice(destination.index, 0, removed);

      // Optimistic update if we had local state for subjects, but here we trigger verified mutation
      const updates = newSubjects.map((s, index) => ({
        id: s.id,
        order: index,
      }));
      reorderSubjectsMutation.mutate(updates);
      return;
    }

    // 2. Reordering Projects (possibly between subjects)
    if (type === "PROJECT") {
      const sourceSubjectId = source.droppableId;
      const destSubjectId = destination.droppableId;

      const sourceList = groupedProjects.get(sourceSubjectId) || [];
      const destList = groupedProjects.get(destSubjectId) || [];

      // If moving within same list
      if (sourceSubjectId === destSubjectId) {
        const newList = Array.from(sourceList);
        const [removed] = newList.splice(source.index, 1);
        newList.splice(destination.index, 0, removed);

        const newGrouped = new Map(groupedProjects);
        newGrouped.set(sourceSubjectId, newList);
        setGroupedProjects(newGrouped);

        // API Update
        const updates = newList.map((p, index) => ({
          id: p.id,
          order: index,
          subjectId: sourceSubjectId === "unfiled" ? null : sourceSubjectId,
        }));
        reorderProjectsMutation.mutate(updates);

      } else {
        // Moving to different list
        const newSourceList = Array.from(sourceList);
        const [removed] = newSourceList.splice(source.index, 1);
        const newDestList = Array.from(destList);
        newDestList.splice(destination.index, 0, removed);

        const newGrouped = new Map(groupedProjects);
        newGrouped.set(sourceSubjectId, newSourceList);
        newGrouped.set(destSubjectId, newDestList);
        setGroupedProjects(newGrouped);

        // API Updates
        // Update destination list order and ownership
        const updates = newDestList.map((p, index) => ({
          id: p.id,
          order: index,
          subjectId: destSubjectId === "unfiled" ? null : destSubjectId,
        }));
        // Note: we strictly only need to update the moved item's subjectId, 
        // but updating the whole list orders is safer for consistency.
        reorderProjectsMutation.mutate(updates);
      }
    }
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
    return <div className="text-center text-muted-foreground">Loading subjects...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Subjects</h1>
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
          <Droppable droppableId="subjects-list" type="SUBJECT">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-8"
              >
                {/* Show subjects with projects */}
                {allSubjects.map((subject, index) => {
                  const subjectProjects = groupedProjects.get(subject.id) || [];
                  if (subjectProjects.length === 0 && activeTab !== "all") return null;

                  return (
                    <Draggable key={subject.id} draggableId={subject.id} index={index}>
                      {(providedDrag) => (
                        <div
                          ref={providedDrag.innerRef}
                          {...providedDrag.draggableProps}
                        >
                          <div {...providedDrag.dragHandleProps} className="mb-2 opacity-50 hover:opacity-100 cursor-grab active:cursor-grabbing w-fit">
                            {/* Drag handle icon or just make the header draggable */}
                          </div>
                          <SubjectSection
                            subject={subject}
                            projects={subjectProjects}
                            orgId={orgId}
                            // We need to pass droppable props to SubjectSection to make it a drop zone for projects
                            isDropZone={true}
                          />
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}

                {/* Unfiled projects section - Not draggable as a subject, but contains droppable projects */}
                {(groupedProjects.get("unfiled") || []).length > 0 && (
                  <SubjectSection
                    subject={{
                      id: "unfiled",
                      name: "Unfiled",
                      description: "Projects without a subject",
                      color: "#9ca3af",
                      projectIds: [],
                      isExpanded: true,
                    }}
                    projects={groupedProjects.get("unfiled") as ProjectDTO[]}
                    orgId={orgId}
                    isDropZone={true}
                  />
                )}
              </div>
            )}
          </Droppable>
        )}
      </DragDropContext>
    </div>
  );
}
