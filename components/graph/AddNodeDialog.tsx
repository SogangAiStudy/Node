"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LimitReachedDialog } from "@/components/dialogs/LimitReachedDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelectSearch, SelectItem as MultiSelectItem } from "@/components/ui/multi-select-search";
import { GraphData, ManualStatus, NodeDTO, NodeType } from "@/types";

interface AddNodeDialogProps {
  projectId: string;
  orgId: string;
  parentNodeId?: string | null;
  parentNodeTitle?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onPendingSaveChange?: (delta: number) => void;
}

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

function makeTempId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

export function AddNodeDialog({ projectId, orgId, parentNodeId, parentNodeTitle, open, onOpenChange, onSuccess, onPendingSaveChange }: AddNodeDialogProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("TASK");
  const [ownerId, setOwnerId] = useState<string>(""); // Primary Owner
  const [participantIds, setParticipantIds] = useState<string[]>([]); // Participating Members
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [dueAt, setDueAt] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);

  const fetchMembersAndTeams = useCallback(async () => {
    try {
      // Fetch members
      const membersRes = await fetch(`/api/projects/${projectId}/members`);
      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members || []);

        // Auto-set current user as owner if they are a member and none selected
        if (session?.user?.id && !ownerId) {
          const isMember = data.members.some((m: Member) => m.userId === session.user?.id);
          if (isMember) {
            setOwnerId(session.user.id);
          }
        }
      }

      // Fetch project teams
      const teamsRes = await fetch(`/api/projects/${projectId}/teams`);
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData.teams || []);
      }
    } catch (error) {
      console.error("Failed to fetch members and teams:", error);
    }
  }, [projectId, session?.user?.id, ownerId]);

  useEffect(() => {
    if (open) {
      fetchMembersAndTeams();
    }
  }, [open, fetchMembersAndTeams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Combine primary owner and participants for the backend
    const allOwnerIds = ownerId ? [ownerId, ...participantIds] : participantIds;
    // Remove duplicates just in case
    const uniqueOwnerIds = Array.from(new Set(allOwnerIds));
    const tempId = makeTempId("temp-node");
    const createdAt = new Date().toISOString();
    const selectedOwner = members.find((member) => member.userId === ownerId);
    const selectedOwners = uniqueOwnerIds
      .map((id) => members.find((member) => member.userId === id))
      .filter((member): member is Member => Boolean(member));
    const selectedTeams = teamIds
      .map((id) => teams.find((team) => team.id === id))
      .filter((team): team is Team => Boolean(team));
    const optimisticNode: NodeDTO = {
      id: tempId,
      orgId,
      projectId,
      parentNodeId: parentNodeId || null,
      teamId: selectedTeams[0]?.id || null,
      teamName: selectedTeams[0]?.name || null,
      ownerId: ownerId || null,
      ownerName: selectedOwner?.userName || null,
      teams: selectedTeams.map((team) => ({ id: team.id, name: team.name })),
      owners: selectedOwners.map((member) => ({ id: member.userId, name: member.userName || "Unknown" })),
      title,
      description: description || null,
      type: type as NodeType,
      manualStatus: ManualStatus.TODO,
      computedStatus: "TODO",
      priority: 3,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      phase: null,
      createdAt,
      updatedAt: createdAt,
      commentCount: 0,
      attachmentCount: 0,
      childCount: 0,
      positionX: parentNodeId ? 48 : Math.random() * 800,
      positionY: parentNodeId ? 96 : Math.random() * 600,
    };

    try {
      onPendingSaveChange?.(1);
      queryClient.setQueryData<GraphData>(["graph", projectId], (old) => {
        if (!old) return old;
        return {
          ...old,
          nodes: [
            ...old.nodes.map((node) =>
              node.id === parentNodeId
                ? { ...node, childCount: (node.childCount || 0) + 1 }
                : node
            ),
            optimisticNode,
          ],
        };
      });
      resetForm();
      onOpenChange(false);
      toast.info("Node added. Saving...");

      const res = await fetch(`/api/projects/${projectId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          type,
          ownerId: ownerId || null, // Primary owner
          ownerIds: uniqueOwnerIds, // All owners/participants
          teamIds,
          parentNodeId: parentNodeId || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      });

      if (!res.ok) {
        const error = await res.json();

        // Check if it's a limit error
        if (error.error === "LIMIT_REACHED") {
          setShowLimitDialog(true);
          queryClient.setQueryData<GraphData>(["graph", projectId], (old) => {
            if (!old) return old;
            return {
              ...old,
              nodes: old.nodes
                .filter((node) => node.id !== tempId)
                .map((node) =>
                  node.id === parentNodeId
                    ? { ...node, childCount: Math.max(0, (node.childCount || 0) - 1) }
                    : node
                ),
            };
          });
          return;
        }

        throw new Error(error.message || "Failed to create node");
      }

      const savedNode = await res.json() as Partial<NodeDTO>;
      queryClient.setQueryData<GraphData>(["graph", projectId], (old) => {
        if (!old) return old;
        return {
          ...old,
          nodes: old.nodes.map((node) =>
            node.id === tempId
              ? { ...optimisticNode, ...savedNode, id: savedNode.id || tempId }
              : node
          ),
        };
      });
      toast.success("Node saved");
      onSuccess();
    } catch (error) {
      queryClient.setQueryData<GraphData>(["graph", projectId], (old) => {
        if (!old) return old;
        return {
          ...old,
          nodes: old.nodes
            .filter((node) => node.id !== tempId)
            .map((node) =>
              node.id === parentNodeId
                ? { ...node, childCount: Math.max(0, (node.childCount || 0) - 1) }
                : node
            ),
        };
      });
      toast.error(error instanceof Error ? error.message : "Failed to create node");
      onSuccess();
    } finally {
      onPendingSaveChange?.(-1);
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setType("TASK");
    // Don't reset ownerId if it's the current user, ideally. 
    // But to match previous behavior closer to "reset":
    if (session?.user?.id && members.some(m => m.userId === session.user?.id)) {
      setOwnerId(session.user.id);
    } else {
      setOwnerId("");
    }
    setParticipantIds([]);
    setTeamIds([]);
    setDueAt("");
  };

  const memberItems: MultiSelectItem[] = members.map((m: Member) => ({
    id: m.userId,
    name: m.userName || "Unknown",
    subtitle: m.teamName || undefined,
    type: "user",
  }));

  const teamItems: MultiSelectItem[] = teams.map((t: Team) => ({
    id: t.id,
    name: t.name,
    type: "team",
  }));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{parentNodeId ? "Add Child Node" : "Add Node"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 my-4">
              {parentNodeId && (
                <div className="rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                  Inside {parentNodeTitle || "selected node"}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="title" className="text-sm font-medium">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  required
                  className="text-base py-5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="type" className="text-sm font-medium">Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TASK">Task</SelectItem>
                      <SelectItem value="DECISION">Decision</SelectItem>
                      <SelectItem value="BLOCKER">Blocker</SelectItem>
                      <SelectItem value="INFOREQ">Info Request</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="owner" className="text-sm font-medium">Primary Owner</Label>
                  <Select value={ownerId} onValueChange={setOwnerId}>
                    <SelectTrigger id="owner">
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.userId} value={member.userId}>
                          {member.userName || "Unknown"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">Participating Members & Teams (optional)</Label>
                  <MultiSelectSearch
                    items={[...memberItems.filter(item => item.id !== ownerId), ...teamItems]}
                    selectedIds={[...participantIds, ...teamIds]}
                    onSelect={(id: string) => {
                      const allItems = [...memberItems, ...teamItems];
                      const item = allItems.find(i => i.id === id);
                      if (!item) return;

                      if (item.type === "user") {
                        setParticipantIds(prev => [...prev, id]);
                      } else if (item.type === "team") {
                        setTeamIds(prev => [...prev, id]);
                      }
                    }}
                    onRemove={(id: string) => {
                      // Try removing from both, as IDs are unique across entities usually
                      // or check existence. Simpler to just filter both.
                      setParticipantIds(prev => prev.filter(i => i !== id));
                      setTeamIds(prev => prev.filter(i => i !== id));
                    }}
                    placeholder="Select members or teams..."
                    searchPlaceholder="Search people or teams..."
                  />
                </div>

                {/* Due Date (Moved up to align with previous design if needed, but keeping flow) */}
                <div className="grid gap-2">
                  <Label htmlFor="dueAt" className="text-sm font-medium">Due Date (optional)</Label>
                  <Input
                    type="date"
                    id="dueAt"
                    value={dueAt}
                    onFocus={() => {
                      if (!dueAt) {
                        const today = new Date();
                        const year = today.getFullYear();
                        const month = String(today.getMonth() + 1).padStart(2, '0');
                        const day = String(today.getDate()).padStart(2, '0');
                        setDueAt(`${year}-${month}-${day}`);
                      }
                    }}
                    onChange={(e) => setDueAt(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description" className="text-sm font-medium">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                    placeholder="Add more context..."
                    className="h-24 resize-none"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1 sm:flex-none">
                {isLoading ? "Creating..." : "Create Node"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog >

      <LimitReachedDialog
        open={showLimitDialog}
        onOpenChange={setShowLimitDialog}
        orgId={orgId}
      />
    </>
  );
}
