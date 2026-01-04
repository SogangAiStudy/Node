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
  HelpCircle,
  Sparkles,
  X,
  ChevronRight,
  CheckCircle2,
  PlayCircle,
  MessageSquarePlus,
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
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const analyzeBlock = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/ai/analyze-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: node.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to analyze");
      }
      const data = await res.json();
      setAiAnalysis(data);
      setShowAnalysis(true);
    } catch (error) {
      setAnalyzeError(error instanceof Error ? error.message : "Failed to analyze");
      setShowAnalysis(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

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

  // Optimistic State
  const [optimisticStatus, setOptimisticStatus] = useState(node.manualStatus);

  useEffect(() => {
    setOptimisticStatus(node.manualStatus);
  }, [node.manualStatus]);

  // Updating Logic
  const updateNode = async (updates: Partial<NodeDTO>, e?: React.MouseEvent | React.FocusEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    setIsUpdating(true);

    // Optimistic Update
    if (updates.manualStatus) {
      setOptimisticStatus(updates.manualStatus);
    }

    try {
      await fetch(`/api/nodes/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      onDataChange();
    } catch (err) {
      // Revert on error
      setOptimisticStatus(node.manualStatus);
      console.error(err);
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
  const isTodo = node.computedStatus === "TODO";
  const isDoing = node.computedStatus === "DOING";
  const isDone = node.computedStatus === "DONE";

  return (
    <div
      className={cn(
        "min-w-[240px] max-w-[280px] rounded-md border bg-white transition-all duration-200",
        // Base state
        "border-slate-200",
        // Selection state
        selected && "border-primary ring-2 ring-primary/30 z-50",
        // Hover
        !selected && "hover:border-slate-300",
        // Faded state (filtering)
        isFaded && "opacity-30 grayscale-[0.8] pointer-events-none",
        // Status-based emphasis
        isBlocked && "border-l-4 border-l-red-500 shadow-md",
        isTodo && !selected && "shadow-lg border-slate-300 scale-[1.02]",
        isDoing && !selected && "ring-2 ring-blue-400/50 shadow-lg border-blue-200",
        isDone && "opacity-60 shadow-none border-slate-100"
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
              <DropdownMenu onOpenChange={(open) => { if (open && !hasLoadedMetadata) fetchMetadata(); }}>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="ml-1 hover:bg-slate-100 p-0.5 rounded text-slate-400 opacity-50 hover:opacity-100 transition-opacity">
                    <Plus className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56" onClick={(e) => e.stopPropagation()}>
                  {members.length === 0 ? (
                    <div className="text-xs text-slate-400 p-2 text-center">Loading...</div>
                  ) : (
                    members.map(m => (
                      <DropdownMenuItem key={m.userId} onClick={() => updateNode({ ownerIds: [m.userId] } as any)}>
                        <span className="text-sm">{m.userName}</span>
                      </DropdownMenuItem>
                    ))
                  )}
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

        {/* Assigned Teams */}
        {node.teams && node.teams.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {node.teams.map(team => (
              <span
                key={team.id}
                className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded"
              >
                {team.name}
              </span>
            ))}
          </div>
        )}

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

        {/* EXPANDED VIEW: Extra Controls when Selected */}
        {selected && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Contextual Action Button */}
            <div className="flex gap-1">
              {node.manualStatus === 'TODO' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateNode({ manualStatus: 'DOING' });
                  }}
                  className="px-3 py-1 text-[10px] font-semibold rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center gap-1"
                >
                  <PlayCircle className="w-3 h-3" />
                  Start
                </button>
              )}
              {node.manualStatus === 'DOING' && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateNode({ manualStatus: 'DONE' });
                    }}
                    className="px-3 py-1 text-[10px] font-semibold rounded bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Done
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateNode({ manualStatus: 'TODO' });
                    }}
                    className="px-2 py-1 text-[10px] font-medium rounded border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Stop
                  </button>
                </>
              )}
              {node.manualStatus === 'DONE' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateNode({ manualStatus: 'TODO' });
                  }}
                  className="px-3 py-1 text-[10px] font-medium rounded border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors flex items-center gap-1"
                >
                  <Clock className="w-3 h-3" />
                  Reopen
                </button>
              )}
            </div>

            {/* Open Sidebar Button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                // @ts-ignore - Passed via data but not typed in CustomNodeProps yet
                if (data.onOpenDetail) data.onOpenDetail();
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Why Blocked? Button - only for BLOCKED status */}
        {isBlocked && (
          <div className="mt-2 text-center">
            <button
              onClick={(e) => { e.stopPropagation(); analyzeBlock(); }}
              disabled={isAnalyzing}
              className="w-full text-[9px] font-medium text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded flex items-center justify-center gap-1 transition-colors"
            >
              {isAnalyzing ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <Sparkles className="w-2.5 h-2.5" />
              )}
              Analyze Blockers
            </button>
          </div>
        )}

        {/* AI Analysis Popup */}
        {showAnalysis && (
          <div className="absolute z-50 top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-slate-200 p-3 text-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                AI Analysis
              </div>
              <button onClick={() => setShowAnalysis(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {analyzeError ? (
              <div className="text-red-600 text-[11px]">{analyzeError}</div>
            ) : aiAnalysis ? (
              <div className="space-y-2">
                {aiAnalysis.summary && (
                  <p className="text-slate-600 leading-relaxed">{aiAnalysis.summary}</p>
                )}

                {aiAnalysis.blockingReasons?.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-700 mb-1">Blocking:</div>
                    <ul className="space-y-1">
                      {aiAnalysis.blockingReasons.map((r: any, i: number) => (
                        <li key={i} className="text-slate-600 bg-slate-50 px-2 py-1 rounded">
                          <span className="font-medium">{r.targetTitle}</span>: {r.actionNeeded}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiAnalysis.whoShouldAct?.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-700 mb-1">Who should act:</div>
                    <ul className="space-y-1">
                      {aiAnalysis.whoShouldAct.map((w: any, i: number) => (
                        <li key={i} className="text-slate-600">
                          <span className="font-medium">{w.name}</span>: {w.nextStep}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-400">Loading...</div>
            )}
          </div>
        )}
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

