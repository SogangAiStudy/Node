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
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editedTitle, setEditedTitle] = useState(node.title);
  const [editedDesc, setEditedDesc] = useState(node.description || "");

  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [hasLoadedMetadata, setHasLoadedMetadata] = useState(false);
  const [showSecondaryTeams, setShowSecondaryTeams] = useState(false);

  // AI Agent State
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeBlock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/ai/analyze-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: node.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data);
      }
    } catch (error) {
      console.error("Analysis failed", error);
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
        setTeams(data.teams || []);
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

  useEffect(() => {
    if (!isEditingTitle) setEditedTitle(node.title);
  }, [node.title, isEditingTitle]);

  useEffect(() => {
    if (!isEditingDesc) setEditedDesc(node.description || "");
  }, [node.description, isEditingDesc]);

  const updateNode = async (updates: Partial<NodeDTO>, e?: React.MouseEvent | React.FocusEvent | React.KeyboardEvent) => {
    if (e) {
      e.stopPropagation();
      // Only prevent default if it's not a focus event to allow tab navigation
      if (!('target' in e && e.type === 'blur')) {
        // e.preventDefault(); // Commented out to allow focus
      }
    }

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/nodes/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        onDataChange();
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const updateStatus = (status: ManualStatus, e?: React.MouseEvent | React.FocusEvent) => {
    updateNode({ manualStatus: status }, e);
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
    await updateStatus(nextStatus, e);
  };

  const handleTitleSave = async (e?: React.FocusEvent | React.KeyboardEvent) => {
    if (editedTitle === node.title) {
      setIsEditingTitle(false);
      return;
    }
    await updateNode({ title: editedTitle } as any, e);
    setIsEditingTitle(false);
  };

  const handleDescSave = async (e?: React.FocusEvent | React.KeyboardEvent) => {
    if (editedDesc === (node.description || "")) {
      setIsEditingDesc(false);
      return;
    }
    await updateNode({ description: editedDesc } as any, e);
    setIsEditingDesc(false);
  };

  const getPrimaryAction = () => {
    if (isUpdating)
      return (
        <Button disabled size="sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating
        </Button>
      );

    switch (node.computedStatus) {
      case "TODO":
        return (
          <Button size="sm" onClick={(e) => updateStatus("DOING", e)}>
            Start Doing
          </Button>
        );
      case "DOING":
        return (
          <Button size="sm" onClick={(e) => updateStatus("DONE", e)}>
            Mark Done
          </Button>
        );
      case "BLOCKED":
        // No primary action for blocked - user can create request in expanded panel
        return null;
      default:
        return null;
    }
  };

  // Determine primary team and secondary teams
  const primaryTeam = node.teams && node.teams.length > 0 ? node.teams[0] : null;
  const secondaryTeams = node.teams && node.teams.length > 1 ? node.teams.slice(1) : [];

  // Determine primary owner and additional owners
  const primaryOwner = node.owners && node.owners.length > 0 ? node.owners[0] : null;
  const additionalOwners = node.owners && node.owners.length > 1 ? node.owners.slice(1) : [];

  // Check if node has no owner (degraded state)
  const hasNoOwner = !primaryOwner;

  return (
    <div
      className={cn(
        "min-w-[280px] max-w-[320px] rounded-lg border-2 bg-white shadow-sm transition-all duration-300",
        selected ? "scale-105 border-primary z-50 ring-2 ring-primary/20" : "hover:border-slate-300",
        hasNoOwner ? "border-amber-300 bg-amber-50/30" : "border-slate-200",
        node.computedStatus === "BLOCKED" && "border-red-300",
        isFaded && "opacity-20 grayscale-[0.5] pointer-events-none hover:opacity-40"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ width: '16px', height: '16px', backgroundColor: '#94a3b8', border: '2px solid white', marginLeft: '-8px' }}
        className="hover:!bg-primary transition-colors cursor-crosshair z-50 shadow-sm"
      />

      <div className="p-4 space-y-3">
        {/* (1) HEADER AREA - Title and Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {isEditingTitle ? (
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={() => handleTitleSave()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTitleSave(e);
                  if (e.key === "Escape") {
                    setIsEditingTitle(false);
                    setEditedTitle(node.title);
                  }
                }}
                autoFocus
                className="h-8 text-base font-bold"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className="group flex items-start gap-1.5 cursor-text"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }}
              >
                <h3 className="font-bold text-base leading-tight text-slate-900 break-words">
                  {node.title}
                </h3>
                <Pencil className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
              </div>
            )}
          </div>

          {/* Status Badge - Fixed Position */}
          <Badge
            className={cn(
              "text-[10px] px-2.5 py-1 cursor-pointer uppercase font-bold tracking-tight transition-all hover:brightness-110 active:scale-95 flex-shrink-0",
              getStatusColor(node.computedStatus),
              isUpdating && "opacity-50 cursor-not-allowed"
            )}
            onClick={handleBadgeClick}
          >
            {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : node.computedStatus}
          </Badge>
        </div>

        {/* (2) RESPONSIBILITY SECTION - Most Important */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Owner</p>
          <div className="flex items-center gap-2">
            {hasNoOwner ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-amber-400 rounded-lg bg-amber-50/50">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span className="text-xs font-medium text-amber-700">No Owner Assigned</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This node needs an owner for accountability</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <>
                {/* Primary Owner - Emphasized */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <Avatar className="h-9 w-9 border-2 border-indigo-500 ring-2 ring-indigo-100 shadow-md">
                          <AvatarFallback className="text-xs font-bold bg-indigo-100 text-indigo-700">
                            {getInitials(primaryOwner.name)}
                          </AvatarFallback>
                        </Avatar>
                        <Crown className="h-3 w-3 text-amber-500 absolute -top-1 -right-1 drop-shadow-sm" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{primaryOwner.name}</p>
                      <p className="text-xs text-muted-foreground">Primary Owner</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Additional Owners - Smaller */}
                {additionalOwners.length > 0 && (
                  <div className="flex -space-x-2">
                    {additionalOwners.map((owner) => (
                      <TooltipProvider key={owner.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Avatar className="h-7 w-7 border-2 border-white shadow-sm hover:z-10 transition-transform hover:scale-110">
                              <AvatarFallback className="text-[9px] font-bold bg-slate-100 text-slate-700">
                                {getInitials(owner.name)}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{owner.name}</p>
                            <p className="text-xs text-muted-foreground">Additional Owner</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Add Owner Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-7 w-7 rounded-full border border-dashed border-slate-300 flex items-center justify-center hover:bg-slate-50 transition-colors bg-white">
                  <Plus className="h-3 w-3 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuLabel className="text-[10px] uppercase font-bold text-slate-400">
                  Manage Owners
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-[300px] overflow-y-auto">
                  {members.map((m) => {
                    const isSelected = node.owners?.some((o) => o.id === m.userId) || false;
                    return (
                      <div
                        key={m.userId}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentOwners = node.owners || [];
                          const newOwnerIds = isSelected
                            ? currentOwners.filter((o) => o.id !== m.userId).map((o) => o.id)
                            : [...currentOwners.map((o) => o.id), m.userId];
                          updateNode({ ownerIds: newOwnerIds } as any);
                        }}
                      >
                        <Checkbox checked={isSelected} onCheckedChange={() => { }} className="pointer-events-none" />
                        <Avatar className="h-6 w-6 border border-slate-100">
                          <AvatarFallback className="text-[9px] font-bold">
                            {getInitials(m.userName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-[11px] leading-none">{m.userName}</span>
                          <span className="text-[9px] text-muted-foreground">{m.teamName || "No Team"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>


        {/* (4) BLOCKED-SPECIFIC SECTION - with AI Agent */}
        {node.computedStatus === "BLOCKED" && (
          <div className="rounded-lg bg-red-50 border-2 border-red-200 p-3 space-y-2 animate-in slide-in-from-top-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <p className="font-bold text-[11px] text-red-900 uppercase tracking-wide">Why Blocked?</p>
              </div>
              {/* AI Agent Trigger */}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px] text-red-700 hover:bg-red-100 hover:text-red-900 border border-red-200 bg-white shadow-sm"
                onClick={handleAnalyzeBlock}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <span className="mr-1">✨</span>
                )}
                {isAnalyzing ? "Analyzing..." : "Ask AI"}
              </Button>
            </div>

            {/* AI Analysis Result */}
            {aiAnalysis ? (
              <div className="space-y-2 bg-white rounded-md border border-red-100 p-2 shadow-sm">
                <p className="text-[11px] font-medium text-slate-800 leading-tight">
                  {aiAnalysis.summary}
                </p>

                {/* Action Items */}
                {aiAnalysis.whoShouldAct?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Action Needed By</p>
                    {aiAnalysis.whoShouldAct.map((actor: any, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-[10px] text-slate-700">
                        <User className="h-3 w-3 mt-0.5 text-slate-400" />
                        <span className="font-semibold">{actor.name}</span>: {actor.nextStep}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Standard Blocked Reasons (Fallback/Initial) */
              <div className="space-y-1.5">
                {blockedBy.length > 0 ? (
                  <ul className="space-y-1 pl-3">
                    {blockedBy.map((title, i) => (
                      <li key={i} className="text-[10px] text-red-700 flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-red-500" />
                        <span className="truncate">{title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[10px] text-red-600 italic pl-1">Blocked by external factors or open requests.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* (5) METADATA FOOTER - Lowest Priority */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(node.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Created: {new Date(node.createdAt).toLocaleString()}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {node.dueAt && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 text-amber-600">
                      <Clock className="h-3 w-3" />
                      {new Date(node.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Due: {new Date(node.dueAt).toLocaleString()}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="text-[9px] font-medium">
            P{node.priority || 3}
          </div>
        </div>
      </div>

      {/* EXPANDED DETAIL PANEL - When Selected */}
      {selected && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-200 pt-3 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Description editing */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Description
            </label>
            {isEditingDesc ? (
              <Textarea
                value={editedDesc}
                onChange={(e) => setEditedDesc(e.target.value)}
                onBlur={() => handleDescSave()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleDescSave(e);
                  if (e.key === "Escape") {
                    setIsEditingDesc(false);
                    setEditedDesc(node.description || "");
                  }
                }}
                autoFocus
                placeholder="Add a description..."
                className="text-[11px] min-h-[60px] p-2 leading-normal"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className="group relative cursor-text min-h-[20px] p-2 rounded border border-slate-200 hover:border-slate-300"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingDesc(true);
                }}
              >
                <p
                  className={cn(
                    "text-[11px] text-slate-600 leading-normal",
                    !node.description && "text-slate-400 italic"
                  )}
                >
                  {node.description || "No description provided."}
                </p>
                <Pencil className="absolute -right-3 top-2 h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

          {/* Blocking Other Nodes */}
          {blocking.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Blocking {blocking.length} Node{blocking.length > 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {blocking.map((title, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-[10px] px-2 py-0.5 border-orange-200 text-orange-700 bg-orange-50"
                  >
                    {title}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            {getPrimaryAction()}
            {/* Create Request - Available for all nodes */}
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setCreateRequestOpen(true);
              }}
            >
              Create Request
            </Button>
          </div>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        style={{ width: '16px', height: '16px', backgroundColor: '#94a3b8', border: '2px solid white', marginRight: '-8px' }}
        className="hover:!bg-primary transition-colors cursor-crosshair z-50 shadow-sm"
      />

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

