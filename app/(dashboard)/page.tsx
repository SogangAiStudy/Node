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
    if (isLoading) return;

    if (workspaces && workspaces.length > 0) {
      router.push(`/org/${workspaces[0].orgId}/projects`);
    } else {
      // No workspaces or error - redirect to onboarding
      router.push("/onboarding");
    }
  }, [workspaces, isLoading, router]);

  // Show error state if API failed
  if (isError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground">Redirecting to onboarding...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center text-muted-foreground">Loading...</div>
    </div>
  );
}
