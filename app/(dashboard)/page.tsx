"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  // Get user's workspaces and redirect to first one
  const { data: workspaces, isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const res = await fetch("/api/workspaces");
      if (!res.ok) throw new Error("Failed to fetch workspaces");
      return res.json() as Promise<Array<{ orgId: string; name: string; hasUnreadInbox: boolean }>>;
    },
  });

  // Redirect to first workspace
  useEffect(() => {
    if (!isLoading && workspaces && workspaces.length > 0) {
      router.push(`/org/${workspaces[0].orgId}/projects`);
    } else if (!isLoading && workspaces && workspaces.length === 0) {
      // No workspaces - redirect to onboarding
      router.push("/onboarding");
    }
  }, [workspaces, isLoading, router]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center text-muted-foreground">Loading...</div>
    </div>
  );
}
