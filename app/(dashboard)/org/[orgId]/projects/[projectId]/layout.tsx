"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectHeader } from "@/components/project/ProjectHeader";

export default function ProjectLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const orgId = params.orgId as string;
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

  const currentTab = pathname.includes("/now")
    ? "now"
    : pathname.includes("/graph")
      ? "graph"
      : "graph";

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

