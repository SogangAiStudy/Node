"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  // Get user's workspaces and redirect to first one
  const { data: workspaces, isLoading, isError } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const res = await fetch("/api/workspaces");
      if (!res.ok) {
        // If unauthorized or error, return empty array
        return [];
      }
      return res.json() as Promise<Array<{ orgId: string; name: string; hasUnreadInbox: boolean }>>;
    },
    retry: 1, // Only retry once
    staleTime: 0,
  });

  // Redirect to first workspace or onboarding
  useEffect(() => {
    if (isLoading || isError) return;

    if (workspaces && workspaces.length > 0) {
      router.push(`/org/${workspaces[0].orgId}/projects`);
    } else if (workspaces && workspaces.length === 0) {
      // ONLY redirect to onboarding if we explicitly have zero workspaces
      router.push("/onboarding");
    }
  }, [workspaces, isLoading, isError, router]);

  // Show error state if API failed
  if (isError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold text-red-600 mb-2">Failed to load workspaces</h2>
          <p className="text-muted-foreground mb-4">There was an error connecting to the server.</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Try refreshing the page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center text-muted-foreground">Loading...</div>
    </div>
  );
}
