import { memo, useState, useEffect } from "react";
import { Handle, Position } from "reactflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NodeDTO, ComputedStatus, ManualStatus } from "@/types";
import { CreateRequestDialog } from "./CreateRequestDialog";
import { cn } from "@/lib/utils";
import { Loader2, User, Check, X, Pencil } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Users } from "lucide-react";

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
  const { node, projectId, onDataChange, blockedBy, blocking } = data;
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
        return (
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              setCreateRequestOpen(true);
            }}
          >
            Create Request
          </Button>
        );
      default:
        return null;
    }
  };

  const showAvatar = node.manualStatus !== "DONE";

  return (
    <div
      className={cn(
        "min-w-[240px] rounded-lg border-2 border-slate-200 bg-white p-4 shadow-sm transition-all duration-200",
        selected ? "scale-105 border-primary z-50 ring-2 ring-primary/20" : "hover:border-slate-300"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 border-2 border-white bg-slate-400 hover:w-4 hover:h-4 hover:bg-primary transition-all cursor-crosshair"
      />

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1">
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
                className="h-7 text-[13px] font-bold py-1 px-2"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className="group flex items-center gap-1 cursor-text"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }}
              >
                <h3 className="font-bold text-[13px] leading-tight text-slate-900">{node.title}</h3>
                <Pencil className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-1 cursor-pointer hover:bg-slate-50 rounded px-1 -ml-1 w-fit transition-colors">
                  <Users className="h-3 w-3 text-slate-400" />
                  <p className={cn(
                    "text-[10px] font-medium uppercase tracking-wider",
                    node.teamName ? "text-primary" : "text-muted-foreground"
                  )}>
                    {node.teamName || "No Team"}
                  </p>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel className="text-[10px] uppercase font-bold text-slate-400">Assign Team</DropdownMenuLabel>
                <DropdownMenuItem onClick={(e) => updateNode({ teamId: null } as any, e)}>
                  None
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {teams.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={(e) => updateNode({ teamId: t.id } as any, e)}
                    className={cn(node.teamId === t.id && "bg-slate-100 font-bold")}
                  >
                    {t.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge
              className={cn(
                "text-[9px] px-2 py-0.5 cursor-pointer uppercase font-bold tracking-tighter transition-all hover:brightness-110 active:scale-95",
                getStatusColor(node.computedStatus),
                isUpdating && "opacity-50 cursor-not-allowed"
              )}
              onClick={handleBadgeClick}
            >
              {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : node.computedStatus}
            </Badge>
            {!isUpdating && (
              <span className="text-[8px] text-slate-400 font-medium uppercase tracking-tighter">
                Click to cycle
              </span>
            )}
          </div>
        </div>

        {/* Owner Avatar Badge - Bottom Left (Only for TODO/DOING) */}
        {showAvatar && (
          <div className="flex items-center gap-2 mt-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="cursor-pointer hover:brightness-95 transition-all">
                  {node.ownerId ? (
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-full pr-2 pl-0.5 py-0.5">
                      <Avatar className="h-5 w-5 border border-white shadow-sm">
                        <AvatarFallback className="text-[9px] font-bold bg-primary text-primary-foreground">
                          {getInitials(node.ownerName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[10px] font-medium text-slate-600 truncate max-w-[120px]">
                        {node.ownerName}
                      </span>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-[9px] font-normal text-slate-400 border-dashed py-0">
                      Unassigned
                    </Badge>
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 overflow-y-auto max-h-[300px]">
                <DropdownMenuLabel className="text-[10px] uppercase font-bold text-slate-400">Assign Owner</DropdownMenuLabel>
                <DropdownMenuItem onClick={(e) => updateNode({ ownerId: null } as any, e)}>
                  Unassigned
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {members.map((m) => (
                  <DropdownMenuItem
                    key={m.userId}
                    onClick={(e) => updateNode({ ownerId: m.userId } as any, e)}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5",
                      node.ownerId === m.userId && "bg-slate-100 font-bold"
                    )}
                  >
                    <Avatar className="h-5 w-5 border border-white">
                      <AvatarFallback className="text-[8px] font-bold">
                        {getInitials(m.userName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-[11px] leading-none">{m.userName}</span>
                      <span className="text-[9px] text-muted-foreground">{m.teamName || "No Team"}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Inline Detail Card */}
        {selected && (
          <div className="mt-4 space-y-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Description editing */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
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
                  className="group relative cursor-text min-h-[20px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingDesc(true);
                  }}
                >
                  <p className={cn(
                    "text-[11px] text-slate-600 leading-normal",
                    !node.description && "text-slate-400 italic"
                  )}>
                    {node.description || "No description provided."}
                  </p>
                  <Pencil className="absolute -right-4 top-0 h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </div>

            {node.computedStatus === "BLOCKED" && blockedBy.length > 0 && (
              <div className="rounded-md bg-red-50 border border-red-100 p-2.5 text-red-700 text-[11px]">
                <p className="font-bold flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  Blocked by
                </p>
                <ul className="list-disc list-inside space-y-0.5">
                  {blockedBy.map((title, i) => (
                    <li key={i} className="truncate">
                      {title}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {blocking.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  Blocking
                </p>
                <div className="flex flex-wrap gap-1">
                  {blocking.map((title, i) => (
                    <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0 border-slate-200 text-slate-500 bg-slate-50">
                      {title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <div className="text-[10px] text-slate-400">
                {node.dueAt && (
                  <span className="flex items-center gap-1">
                    Due: {new Date(node.dueAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              {getPrimaryAction()}
            </div>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 border-2 border-white bg-slate-400 hover:w-4 hover:h-4 hover:bg-primary transition-all cursor-crosshair"
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

