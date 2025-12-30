import { memo, useState } from "react";
import { Handle, Position } from "reactflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NodeDTO, ComputedStatus, ManualStatus } from "@/types";
import { CreateRequestDialog } from "./CreateRequestDialog";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface CustomNodeProps {
  data: {
    node: NodeDTO;
    projectId: string;
    onDataChange: () => void;
    blockedBy: string[];
    blocking: string[];
  };
  selected?: boolean;
}

function getStatusColor(status: ComputedStatus): string {
  switch (status) {
    case "BLOCKED":
      return "bg-red-500 text-white";
    case "WAITING":
      return "bg-yellow-500 text-white";
    case "DONE":
      return "bg-green-500 text-white";
    case "DOING":
      return "bg-blue-500 text-white";
    case "TODO":
      return "bg-gray-500 text-white";
    default:
      return "bg-gray-500 text-white";
  }
}

export const CustomNode = memo(({ data, selected }: CustomNodeProps) => {
  const { node, projectId, onDataChange, blockedBy, blocking } = data;
  const [createRequestOpen, setCreateRequestOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const updateStatus = async (status: ManualStatus) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/nodes/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualStatus: status }),
      });
      if (res.ok) {
        onDataChange();
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBadgeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUpdating) return;

    let nextStatus: ManualStatus;
    switch (node.manualStatus) {
      case "TODO":
        nextStatus = "DOING";
        break;
      case "DOING":
        nextStatus = "DONE";
        break;
      case "DONE":
        nextStatus = "TODO";
        break;
      default:
        nextStatus = "TODO";
    }
    await updateStatus(nextStatus);
  };

  const getPrimaryAction = () => {
    if (isUpdating) return <Button disabled size="sm"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating</Button>;

    switch (node.computedStatus) {
      case "TODO":
        return <Button size="sm" onClick={() => updateStatus("DOING")}>Start Doing</Button>;
      case "DOING":
        return <Button size="sm" onClick={() => updateStatus("DONE")}>Mark Done</Button>;
      case "BLOCKED":
        return (
          <Button size="sm" variant="secondary" onClick={() => setCreateRequestOpen(true)}>
            Create Request
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "min-w-[220px] rounded-lg border-2 border-gray-300 bg-white p-3 shadow-md transition-all duration-200",
        selected ? "scale-105 border-primary z-50" : "scale-100"
      )}
    >
      <Handle type="target" position={Position.Left} />

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-sm leading-tight">{node.title}</h3>
          <Badge
            className={cn(
              "text-[10px] px-1.5 py-0 cursor-pointer hover:brightness-110 active:scale-95 transition-all",
              getStatusColor(node.computedStatus),
              isUpdating && "opacity-50 cursor-not-allowed"
            )}
            onClick={handleBadgeClick}
          >
            {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : node.computedStatus}
          </Badge>
        </div>

        {node.ownerName && (
          <p className="text-[10px] text-muted-foreground leading-none">
            Owner: {node.ownerName}
          </p>
        )}

        {/* Inline Detail Card */}
        {selected && (
          <div className="mt-3 space-y-3 pt-3 border-t text-[11px] animate-in fade-in slide-in-from-top-1 duration-200">
            {node.computedStatus === "BLOCKED" && blockedBy.length > 0 && (
              <div className="rounded bg-red-50 p-2 text-red-700">
                <p className="font-semibold mb-1">Blocked by:</p>
                <ul className="list-disc list-inside">
                  {blockedBy.map((title, i) => (
                    <li key={i}>{title}</li>
                  ))}
                </ul>
              </div>
            )}

            {blocking.length > 0 && (
              <div>
                <p className="font-semibold text-muted-foreground mb-1">Blocking:</p>
                <div className="flex flex-wrap gap-1">
                  {blocking.map((title, i) => (
                    <Badge key={i} variant="outline" className="text-[9px] px-1 py-0">
                      {title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-1">
              {getPrimaryAction()}
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} />

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
    </div>
  );
});

CustomNode.displayName = "CustomNode";

