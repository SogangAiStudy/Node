"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NodeDTO, RequestDTO, ComputedStatus } from "@/types";
import { CreateRequestDialog } from "./CreateRequestDialog";

interface NodeDetailPanelProps {
  projectId: string;
  node: NodeDTO;
  onClose: () => void;
  onDataChange: () => void;
}

function getStatusColor(status: ComputedStatus): string {
  switch (status) {
    case "BLOCKED":
      return "bg-red-500";
    case "WAITING":
      return "bg-yellow-500";
    case "DONE":
      return "bg-green-500";
    case "DOING":
      return "bg-blue-500";
    case "TODO":
      return "bg-gray-500";
    default:
      return "bg-gray-500";
  }
}

export function NodeDetailPanel({ projectId, node, onClose, onDataChange }: NodeDetailPanelProps) {
  const [createRequestOpen, setCreateRequestOpen] = useState(false);

  const { data: requests } = useQuery({
    queryKey: ["node-requests", node.id],
    queryFn: async () => {
      const res = await fetch(`/api/requests/inbox?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch requests");
      const data = await res.json();
      return data.requests.filter((r: RequestDTO) => r.linkedNodeId === node.id);
    },
  });

  return (
    <>
      <Sheet open={true} onOpenChange={onClose}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{node.title}</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-2">Status</h3>
              <Badge className={getStatusColor(node.computedStatus)}>{node.computedStatus}</Badge>
            </div>

            {node.description && (
              <div>
                <h3 className="text-sm font-medium mb-2">Description</h3>
                <p className="text-sm text-muted-foreground">{node.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium mb-1">Type</h3>
                <p className="text-sm text-muted-foreground">{node.type}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-1">Priority</h3>
                <p className="text-sm text-muted-foreground">{node.priority}</p>
              </div>
            </div>

            {node.ownerName && (
              <div>
                <h3 className="text-sm font-medium mb-1">Owner</h3>
                <p className="text-sm text-muted-foreground">{node.ownerName}</p>
              </div>
            )}

            {node.team && (
              <div>
                <h3 className="text-sm font-medium mb-1">Team</h3>
                <p className="text-sm text-muted-foreground">{node.team}</p>
              </div>
            )}

            {node.dueAt && (
              <div>
                <h3 className="text-sm font-medium mb-1">Due Date</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(node.dueAt).toLocaleDateString()}
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Requests</h3>
                <Button size="sm" onClick={() => setCreateRequestOpen(true)}>
                  Create Request
                </Button>
              </div>

              {requests && requests.length > 0 ? (
                <div className="space-y-2">
                  {requests.map((req: RequestDTO) => (
                    <Card key={req.id}>
                      <CardHeader className="p-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{req.question}</CardTitle>
                          <Badge variant="outline">{req.status}</Badge>
                        </div>
                      </CardHeader>
                      {req.responseFinal && (
                        <CardContent className="p-3 pt-0">
                          <p className="text-xs text-muted-foreground">
                            Response: {req.responseFinal}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No requests</p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <CreateRequestDialog
        projectId={projectId}
        linkedNodeId={node.id}
        open={createRequestOpen}
        onOpenChange={setCreateRequestOpen}
        onSuccess={() => {
          onDataChange();
          setCreateRequestOpen(false);
        }}
      />
    </>
  );
}
