"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { ProjectDTO } from "@/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DashboardPage() {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Check if user has an organization
  const { data: orgStatus, isLoading: isCheckingOrg, isFetching } = useQuery({
    queryKey: ["organization-status"],
    queryFn: async () => {
      const res = await fetch("/api/user/organization-status");
      if (!res.ok) throw new Error("Failed to check organization status");
      return res.json() as Promise<{ hasOrganization: boolean; organization: any }>;
    },
    staleTime: 0, // Ensure we always check on mount
  });

  // Redirect to onboarding if user has no organization
  useEffect(() => {
    if (!isCheckingOrg && !isFetching && orgStatus && !orgStatus.hasOrganization) {
      router.push("/onboarding");
    }
  }, [orgStatus, isCheckingOrg, isFetching, router]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json() as Promise<{ projects: ProjectDTO[] }>;
    },
    enabled: orgStatus?.hasOrganization === true, // Only fetch projects if user has org
  });

  // Show loading while checking organization
  if (isCheckingOrg) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Don't render if user has no org (will redirect)
  if (!orgStatus?.hasOrganization) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Tabs value="projects" className="mb-6">
        <TabsList>
          <Link href="/">
            <TabsTrigger value="projects">Projects</TabsTrigger>
          </Link>
          <TabsTrigger value="now" disabled className="opacity-50">Now</TabsTrigger>
          <TabsTrigger value="graph" disabled className="opacity-50">Graph</TabsTrigger>
          <TabsTrigger value="inbox" disabled className="opacity-50">Inbox</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Manage your collaboration projects</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>Create Project</Button>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground">Loading projects...</div>
      ) : data?.projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="mb-4 text-muted-foreground">No projects yet</p>
            <Button onClick={() => setCreateDialogOpen(true)}>Create your first project</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}/now`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>
                    {project.memberCount} {project.memberCount === 1 ? "member" : "members"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          refetch();
          setCreateDialogOpen(false);
        }}
      />
    </div>
  );
}
