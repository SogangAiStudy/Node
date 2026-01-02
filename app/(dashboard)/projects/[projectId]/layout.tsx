"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectHeader } from "@/components/project/ProjectHeader";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const projectId = params.projectId as string;
  const orgId = params.orgId as string;

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
      : pathname.includes("/inbox")
        ? "inbox"
        : pathname === "/"
          ? "projects"
          : "now";

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

      <div className="container mx-auto px-4 py-8 flex-1 overflow-auto">
        <Tabs value={currentTab} className="mb-6">
          <TabsList>
            <Link href="/">
              <TabsTrigger value="projects">Projects</TabsTrigger>
            </Link>
            <Link href={`/projects/${projectId}/now`}>
              <TabsTrigger value="now">Now</TabsTrigger>
            </Link>
            <Link href={`/projects/${projectId}/graph`}>
              <TabsTrigger value="graph">Graph</TabsTrigger>
            </Link>
            <Link href={`/projects/${projectId}/inbox`}>
              <TabsTrigger value="inbox">Inbox</TabsTrigger>
            </Link>
          </TabsList>
        </Tabs>
        {children}
      </div>
    </div>
  );
}
