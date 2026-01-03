import { memo, useState, useEffect } from "react";
import { Handle, Position } from "reactflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NodeDTO, ComputedStatus, ManualStatus } from "@/types";
import { CreateRequestDialog } from "./CreateRequestDialog";
import { cn } from "@/lib/utils";
import {
  Loader2,
  User,
  Pencil,
  Crown,
  AlertCircle,
  Clock,
  Calendar,
  ChevronDown,
  Plus,
  Ban,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Member {
  userId: string;
  userName: string | null;
  teamId: string | null;
  teamName: string | null;
}

interface Team {
  id: string;
  name: string;
}

interface CustomNodeProps {
  data: {
    node: NodeDTO;
    projectId: string;
    onDataChange: () => void;
    blockedBy: string[];
    blocking: string[];
    isFaded?: boolean;
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

function getInitials(name: string | null) {
  if (!name) return "??";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export const CustomNode = memo(({ data, selected }: CustomNodeProps) => {
  const { node, projectId, onDataChange, blockedBy, blocking, isFaded } = data;
  const [createRequestOpen, setCreateRequestOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(node.title);

  // Metadata
  const [members, setMembers] = useState<Member[]>([]);
  const [hasLoadedMetadata, setHasLoadedMetadata] = useState(false);

  // AI Analysis (Subtle trigger)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fetchMetadata = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setHasLoadedMetadata(true);
      }
    } catch (error) {
      console.error("Failed to fetch node metadata:", error);
    }
  };

  useEffect(() => {
    if (selected && !hasLoadedMetadata) {
      fetchMetadata();
    }
  }, [selected, hasLoadedMetadata]);

  // Updating Logic
  const updateNode = async (updates: Partial<NodeDTO>, e?: React.MouseEvent | React.FocusEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    setIsUpdating(true);
    try {
      await fetch(`/api/nodes/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      onDataChange();
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTitleSave = async () => {
    if (editedTitle === node.title) {
      setIsEditingTitle(false);
      return;
    }
    await updateNode({ title: editedTitle } as any);
    setIsEditingTitle(false);
  };

  const handleStatusClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Simple status cycle for now
    const map: Record<string, ManualStatus> = { 'TODO': 'DOING', 'DOING': 'DONE', 'DONE': 'TODO' };
    const next = map[node.manualStatus] || 'TODO';
    updateNode({ manualStatus: next });
  };

  // derived values
  const primaryOwner = node.owners?.[0];
  const hasNoOwner = !primaryOwner;
  const isBlocked = node.computedStatus === "BLOCKED";

  return (
    <div
      className={cn(
        "min-w-[240px] max-w-[280px] rounded-md border bg-white shadow-sm transition-all duration-200",
        // Selection state: Primary border, slight lift.
        selected ? "border-primary ring-1 ring-primary/20 z-50 shadow-md" : "border-slate-200 hover:border-slate-300",
        // Faded state (filtering)
        isFaded && "opacity-30 grayscale-[0.8] pointer-events-none",
        // NO warning colors for missing owner.
        // Status Specific Borders only if critical (Blocked)
        isBlocked && "border-l-4 border-l-red-500"
      )}
    >
      {/* Left Handle (Input) */}
      <Handle
        type="target"
        position={Position.Left}
        className={cn(
          "!w-2 !h-4 !rounded-sm !bg-slate-300 hover:!bg-primary transition-colors border-none",
          isBlocked && "!bg-red-300"
        )}
      />

      <div className="p-3">
        {/* 1. Header: Title & Status */}
        <div className="flex items-start justify-between gap-2 mb-2">
          {isEditingTitle ? (
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
              autoFocus
              className="h-6 text-sm font-semibold px-1 py-0"
            />
          ) : (
            <h3
              className="font-semibold text-sm text-slate-900 leading-snug cursor-text"
              onDoubleClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }}
            >
              {node.title}
            </h3>
          )}

          {/* Status (Subtle) */}
          <Badge
            variant="secondary"
            className={cn(
              "text-[9px] px-1.5 py-0 uppercase tracking-wide font-medium cursor-pointer select-none",
              node.computedStatus === "DONE" && "bg-slate-100 text-slate-500 line-through",
              node.computedStatus === "DOING" && "bg-blue-50 text-blue-600",
              node.computedStatus === "WAITING" && "bg-yellow-50 text-yellow-600",
              node.computedStatus === "BLOCKED" && "bg-red-50 text-red-600"
            )}
            onClick={handleStatusClick}
          >
            {node.computedStatus}
          </Badge>
        </div>

        {/* 2. Owner (Clean, Neutral) */}
        <div className="min-h-[24px] flex items-center mb-2">
          {hasNoOwner ? (
            // Calm Unassigned State
            <div className="flex items-center gap-1.5 text-slate-400">
              <div className="w-5 h-5 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center">
                <User className="w-3 h-3 text-slate-300" />
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Unassigned</span>
              {/* Tiny Add Button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="ml-1 hover:bg-slate-100 p-0.5 rounded text-slate-400 opacity-50 hover:opacity-100 transition-opacity">
                    <Plus className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {members.map(m => (
                    <DropdownMenuItem key={m.userId} onClick={() => updateNode({ ownerIds: [m.userId] } as any)}>
                      <span className="text-sm">{m.userName}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            // Assigned Owner
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5 border border-slate-100">
                <AvatarFallback className="text-[9px] bg-indigo-50 text-indigo-700">
                  {getInitials(primaryOwner.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] font-medium text-slate-600 truncate max-w-[120px]">
                {primaryOwner.name}
              </span>
            </div>
          )}
        </div>

        {/* 3. Metadata (Subtle Footer) */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-1">
          <div className="flex items-center gap-2 text-slate-400">
            {node.dueAt && (
              <div className={cn("text-[9px] flex items-center gap-1",
                new Date(node.dueAt) < new Date() ? "text-red-400" : "text-slate-400"
              )}>
                <Calendar className="w-2.5 h-2.5" />
                <span>{new Date(node.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </div>
            )}
          </div>

          {/* Blocked Count (if blocking others) */}
          {(node.blocksCount || 0) > 0 && (
            <div className="text-[9px] font-medium text-orange-600 bg-orange-50 px-1 rounded flex items-center gap-1">
              <Ban className="w-2.5 h-2.5" />
              {node.blocksCount}
            </div>
          )}
        </div>
      </div>

      {/* Right Handle (Output) */}
      <Handle
        type="source"
        position={Position.Right}
        className={cn(
          "!w-2 !h-4 !rounded-sm !bg-slate-300 hover:!bg-primary transition-colors border-none",
          isBlocked && "!bg-red-300"
        )}
      />
    </div>
  );
});

CustomNode.displayName = "CustomNode";

