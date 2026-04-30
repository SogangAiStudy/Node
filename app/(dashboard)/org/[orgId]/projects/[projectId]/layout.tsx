"use client";

import { ReactNode } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ProjectHeader } from "@/components/project/ProjectHeader";

export default function ProjectLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const projectId = params.projectId as string;

  // Fetch project data for header
  const { data: projectData } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      return res.json() as Promise<{ id: string; name: string; orgId: string }>;
    },
    enabled: !!projectId,
  });

  return (
    <div className="flex flex-col h-screen">
      {/* Project Header */}
      {projectData && (
        <ProjectHeader
          projectId={projectId}
          projectName={projectData.name}
          orgId={projectData.orgId}
        />
      )}

      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
