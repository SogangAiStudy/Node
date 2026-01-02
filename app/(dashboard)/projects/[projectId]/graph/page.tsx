"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { GraphData } from "@/types";

export default function GraphPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["graph", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/graph`);
      if (!res.ok) throw new Error("Failed to fetch graph");
      return res.json() as Promise<GraphData>;
    },
  });

  if (isLoading) {
    return <div className="text-center text-muted-foreground">Loading graph...</div>;
  }

  if (!data) {
    return <div className="text-center text-muted-foreground">No data available</div>;
  }

  const orgId = data.nodes[0]?.orgId;

  return (
    <div className="h-[calc(100vh-12rem)]">
      <GraphCanvas projectId={projectId} orgId={orgId} data={data} onDataChange={refetch} />
    </div>
  );
}
