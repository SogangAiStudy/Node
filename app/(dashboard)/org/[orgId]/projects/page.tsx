"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
  groupProjectsBySubject,
  mockSubjects,
} from "@/lib/mock-workspace-data";

interface Project {
  id: string;
  name: string;
  description: string | null;
  primaryTeamName: string | null;
  createdAt: string;
  updatedAt: string;
  subjectId?: string | null;
}

export default function OrgProjectsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["projects", orgId],
    queryFn: async () => {
      const res = await fetch(`/api/projects?orgId=${orgId}`);
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json() as Promise<{ projects: Project[] }>;
    },
  });

  const { data: subjectsData, isLoading: isSubjectsLoading } = useQuery({
    queryKey: ["subjects", orgId],
    queryFn: async () => {
      const res = await fetch(`/api/subjects?orgId=${orgId}`);
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return res.json() as Promise<{ subjects: any[] }>;
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
    // Only use mock subjects if no real ones exist yet (optional fallback)
    return realSubjects.length > 0 ? realSubjects : mockSubjects;
  }, [subjectsData?.subjects]);

  // Filter projects by active tab
  const filteredProjects = useMemo(() => {
    return filterProjectsByTab(enrichedProjects, activeTab);
  }, [enrichedProjects, activeTab]);

  // Group projects by subject
  const groupedProjects = useMemo(() => {
    const grouped = new Map<string, ProjectDTO[]>();

    // Initialize groups
    allSubjects.forEach(s => grouped.set(s.id, []));
    grouped.set("unfiled", []);

    filteredProjects.forEach(p => {
      const subjectId = p.subjectId || "unfiled";
      const existing = grouped.get(subjectId) || [];
      grouped.set(subjectId, [...existing, p as ProjectDTO]);
    });

    return grouped;
  }, [filteredProjects, allSubjects]);

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
    return <div className="text-center text-muted-foreground">Loading projects...</div>;
  }

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

      {/* Projects by Subject */}
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
          {/* Show subjects with projects */}
          {allSubjects.map((subject) => {
            const subjectProjects = groupedProjects.get(subject.id) || [];
            if (subjectProjects.length === 0 && activeTab !== "all") return null;

            return (
              <SubjectSection
                key={subject.id}
                subject={subject}
                projects={subjectProjects}
                orgId={orgId}
              />
            );
          })}

          {/* Unfiled projects section */}
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
            />
          )}
        </div>
      )}
    </div>
  );
}
