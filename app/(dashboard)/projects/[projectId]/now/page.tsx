"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NowData, NodeDTO } from "@/types";
import Link from "next/link";

function NodeCard({ node, projectId }: { node: NodeDTO; projectId: string }) {
  return (
    <Link href={`/projects/${projectId}/graph`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-medium">{node.title}</CardTitle>
            <Badge variant="outline">{node.computedStatus}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {node.ownerName && (
            <p className="text-xs text-muted-foreground mb-1">Owner: {node.ownerName}</p>
          )}
          {node.teamName && <p className="text-xs text-muted-foreground mb-1">Team: {node.teamName}</p>}
          {node.dueAt && (
            <p className="text-xs text-muted-foreground">
              Due: {new Date(node.dueAt).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function NowPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { data, isLoading } = useQuery({
    queryKey: ["now", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/now`);
      if (!res.ok) throw new Error("Failed to fetch now data");
      return res.json() as Promise<NowData>;
    },
  });

  if (isLoading) {
    return <div className="text-center text-muted-foreground">Loading...</div>;
  }

  if (!data) {
    return <div className="text-center text-muted-foreground">No data available</div>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          My Todos
          <Badge variant="secondary">{data.myTodos.length}</Badge>
        </h2>
        <div className="space-y-3">
          {data.myTodos.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No actionable todos
              </CardContent>
            </Card>
          ) : (
            data.myTodos.map((node) => <NodeCard key={node.id} node={node} projectId={projectId} />)
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          My Waiting
          <Badge variant="secondary">{data.myWaiting.length}</Badge>
        </h2>
        <div className="space-y-3">
          {data.myWaiting.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nothing waiting
              </CardContent>
            </Card>
          ) : (
            data.myWaiting.map((node) => <NodeCard key={node.id} node={node} projectId={projectId} />)
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          I'm Blocking
          <Badge variant="secondary">{data.imBlocking.length}</Badge>
        </h2>
        <div className="space-y-3">
          {data.imBlocking.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Not blocking anyone
              </CardContent>
            </Card>
          ) : (
            data.imBlocking.map((item) => (
              <Card key={item.blockedNode.id} className="cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    {item.blockedNode.title} (Blocked)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-2">
                    Waiting on: <span className="font-medium">{item.waitingOnMyNode.title}</span>
                  </p>
                  {item.blockedNode.ownerName && (
                    <p className="text-xs text-muted-foreground">
                      Owner: {item.blockedNode.ownerName}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
