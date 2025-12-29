import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Badge } from "@/components/ui/badge";
import { NodeDTO, ComputedStatus } from "@/types";

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

export const CustomNode = memo(({ data }: { data: { node: NodeDTO } }) => {
  const { node } = data;

  return (
    <div className="min-w-[200px] rounded-lg border-2 border-gray-300 bg-white p-3 shadow-md">
      <Handle type="target" position={Position.Top} />

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-tight">{node.title}</h3>
          <Badge className={getStatusColor(node.computedStatus)}>{node.computedStatus}</Badge>
        </div>

        {node.ownerName && (
          <p className="text-xs text-muted-foreground">Owner: {node.ownerName}</p>
        )}

        {node.team && <p className="text-xs text-muted-foreground">Team: {node.team}</p>}

        {node.dueAt && (
          <p className="text-xs text-muted-foreground">
            Due: {new Date(node.dueAt).toLocaleDateString()}
          </p>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});

CustomNode.displayName = "CustomNode";
