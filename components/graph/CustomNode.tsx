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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

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
        style={{ width: '16px', height: '16px', backgroundColor: '#94a3b8', border: '2px solid white', marginLeft: '-8px' }}
        className="hover:!bg-primary transition-colors cursor-crosshair z-50 shadow-sm"
      />

      <div className="space-y-4">
        {/* Title and Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
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
                <h3 className="font-bold text-[14px] leading-tight text-slate-900">{node.title}</h3>
                <Pencil className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
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
        </div>

        {/* Teams in Box */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {node.teams && node.teams.length > 0 ? (
              node.teams.map((t) => (
                <div
                  key={t.id}
                  className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase tracking-tighter"
                >
                  {t.name}
                </div>
              ))
            ) : (
              <div className="text-[10px] text-slate-400 italic">No team assigned</div>
            )}
          </div>
        </div>

        {/* Members Label and Icons */}
        <div className="space-y-1">
          <p className="text-[11px] text-slate-500 font-medium">members</p>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {(node.owners || []).length > 0 ? (
                (node.owners || []).map((owner) => (
                  <Avatar key={owner.id} className="h-7 w-7 border-2 border-white shadow-sm hover:z-10 transition-transform hover:scale-110">
                    <AvatarFallback className="text-[9px] font-bold bg-indigo-100 text-indigo-700">
                      {getInitials(owner.name)}
                    </AvatarFallback>
                  </Avatar>
                ))
              ) : (
                <div className="h-7 w-7 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
                  <User className="h-3 w-3 text-slate-300" />
                </div>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-6 w-6 rounded-full border border-dashed border-slate-300 flex items-center justify-center hover:bg-slate-50 transition-colors bg-white">
                  <Plus className="h-3 w-3 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuLabel className="text-[10px] uppercase font-bold text-slate-400">Manage Owners</DropdownMenuLabel>
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
                            ? currentOwners.filter(o => o.id !== m.userId).map(o => o.id)
                            : [...currentOwners.map(o => o.id), m.userId];
                          updateNode({ ownerIds: newOwnerIds } as any);
                        }}
                      >
                        <Checkbox checked={isSelected} onCheckedChange={() => { }} className="pointer-events-none" />
                        <Avatar className="h-6 w-6 border border-slate-100">
                          <AvatarFallback className="text-[9px] font-bold">{getInitials(m.userName)}</AvatarFallback>
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

        {/* Creation Date and Secondary Actions */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-50">
          <span className="text-[10px] text-slate-400 font-medium">
            Created {new Date(node.createdAt).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Context for "Click to cycle" if needed, but keeping it clean */}
          </div>
        </div>
      </div>

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

