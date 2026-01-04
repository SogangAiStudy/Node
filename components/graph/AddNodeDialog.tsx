"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
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

interface AddNodeDialogProps {
  projectId: string;
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
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

interface Team {
  id: string;
  name: string;
}

export function AddNodeDialog({ projectId, orgId, open, onOpenChange, onSuccess }: AddNodeDialogProps) {
  const { data: session } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("TASK");
  const [ownerId, setOwnerId] = useState<string>(""); // Primary Owner
  const [participantIds, setParticipantIds] = useState<string[]>([]); // Participating Members
  const [teamIds, setTeamIds] = useState<string[]>([]);
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

    try {
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
        }),
      });

      if (!res.ok) {
        const error = await res.json();

        // Check if it's a limit error
        if (error.error === "LIMIT_REACHED") {
          setShowLimitDialog(true);
          onOpenChange(false); // Close the add node dialog
          return;
        }

        throw new Error(error.message || "Failed to create node");
      }

      toast.success("Node created successfully");
      resetForm();
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create node");
    } finally {
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
              <DialogTitle>Add Node</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 my-4">
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
                  <Label className="text-sm font-medium">Participating Members (optional)</Label>
                  <MultiSelectSearch
                    items={memberItems.filter(item => item.id !== ownerId)} // Exclude primary owner
                    selectedIds={participantIds}
                    onSelect={(id: string) => setParticipantIds((prev: string[]) => [...prev, id])}
                    onRemove={(id: string) => setParticipantIds((prev: string[]) => prev.filter((i: string) => i !== id))}
                    placeholder="Select participants"
                    searchPlaceholder="Search people..."
                  />
                </div>

                {teams.length > 0 && (
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium">Participating Teams (optional)</Label>
                    <MultiSelectSearch
                      items={teamItems}
                      selectedIds={teamIds}
                      onSelect={(id: string) => setTeamIds((prev: string[]) => [...prev, id])}
                      onRemove={(id: string) => setTeamIds((prev: string[]) => prev.filter((i: string) => i !== id))}
                      placeholder="Select teams"
                      searchPlaceholder="Search teams..."
                    />
                  </div>
                )}
              </div>
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
