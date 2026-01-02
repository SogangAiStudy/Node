"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NowData, NodeDTO } from "@/types";
import Link from "next/link";

function getInitials(name: string | null) {
  if (!name) return "??";
  return name
    .split(' ')
    .filter(n => n.length > 0)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function NodeCard({ node, orgId, projectId }: { node: NodeDTO; orgId: string; projectId: string }) {
  return (
    <Link href={`/org/${orgId}/projects/${projectId}/graph?nodeId=${node.id}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-medium">{node.title}</CardTitle>
            <Badge variant="outline">{node.computedStatus}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {node.owners && node.owners.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Owners:</span>
              <div className="flex -space-x-1.5 overflow-hidden">
                {node.owners.slice(0, 3).map((owner) => (
                  <div key={owner.id} title={owner.name} className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-[8px] font-bold text-primary-foreground border-2 border-white shadow-sm">
                    {getInitials(owner.name)}
                  </div>
                ))}
                {node.owners.length > 3 && (
                  <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-500 border-2 border-white shadow-sm">
                    +{node.owners.length - 3}
                  </div>
                )}
              </div>
            </div>
          ) : node.ownerName && (
            <p className="text-xs text-muted-foreground">Owner: {node.ownerName}</p>
          )}

          {node.teams && node.teams.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {node.teams.map((t) => (
                <Badge key={t.id} variant="secondary" className="text-[8px] px-1 py-0 bg-blue-50 text-blue-600 border-blue-100 uppercase tracking-tighter">
                  {t.name}
                </Badge>
              ))}
            </div>
          ) : node.teamName && (
            <p className="text-xs text-muted-foreground text-[10px]">Team: {node.teamName}</p>
          )}

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

export default function ProjectNowPage() {
  const params = useParams();
  const orgId = params.orgId as string;
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
          <Badge variant="secondary">{(data.myTodos || []).length}</Badge>
        </h2>
        <div className="space-y-3">
          {(!data.myTodos || data.myTodos.length === 0) ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No actionable todos
              </CardContent>
            </Card>
          ) : (
            (data.myTodos || []).map((node) => <NodeCard key={node.id} node={node} orgId={orgId} projectId={projectId} />)
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          My Waiting
          <Badge variant="secondary">{(data.myWaiting || []).length}</Badge>
        </h2>
        <div className="space-y-3">
          {(!data.myWaiting || data.myWaiting.length === 0) ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nothing waiting
              </CardContent>
            </Card>
          ) : (
            (data.myWaiting || []).map((node) => <NodeCard key={node.id} node={node} orgId={orgId} projectId={projectId} />)
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          I'm Blocking
          <Badge variant="secondary">{(data.imBlocking || []).length}</Badge>
        </h2>
        <div className="space-y-3">
          {(!data.imBlocking || data.imBlocking.length === 0) ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Not blocking anyone
              </CardContent>
            </Card>
          ) : (
            (data.imBlocking || []).map((item) => (
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
