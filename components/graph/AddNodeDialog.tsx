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

export function AddNodeDialog({ projectId, orgId, open, onOpenChange, onSuccess }: AddNodeDialogProps) {
  const { data: session } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("TASK");
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);

  const fetchMembersAndTeams = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setTeams(data.teams || []);

        // Auto-set current user as owner if they are a member and none selected
        if (session?.user?.id && ownerIds.length === 0) {
          const isMember = data.members.some((m: Member) => m.userId === session.user?.id);
          if (isMember) {
            setOwnerIds([session.user.id]);
            // Also try to set their team
            const currentMember = data.members.find((m: Member) => m.userId === session.user?.id);
            if (currentMember?.teamId) {
              setTeamIds([currentMember.teamId]);
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch members and teams:", error);
    }
  }, [projectId, session?.user?.id, ownerIds.length]);

  useEffect(() => {
    if (open) {
      fetchMembersAndTeams();
    }
  }, [open, fetchMembersAndTeams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          type,
          ownerIds,
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
    setOwnerIds([]);
    setTeamIds([]);
  };

  const ownerItems: MultiSelectItem[] = members.map((m: Member) => ({
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
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">Owners</Label>
                  <MultiSelectSearch
                    items={ownerItems}
                    selectedIds={ownerIds}
                    onSelect={(id: string) => setOwnerIds((prev: string[]) => [...prev, id])}
                    onRemove={(id: string) => setOwnerIds((prev: string[]) => prev.filter((i: string) => i !== id))}
                    placeholder="Select owners"
                    searchPlaceholder="Search people..."
                  />
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm font-medium">Assigned Teams</Label>
                  <MultiSelectSearch
                    items={teamItems}
                    selectedIds={teamIds}
                    onSelect={(id: string) => setTeamIds((prev: string[]) => [...prev, id])}
                    onRemove={(id: string) => setTeamIds((prev: string[]) => prev.filter((i: string) => i !== id))}
                    placeholder="Select teams"
                    searchPlaceholder="Search teams..."
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
      </Dialog>

      <LimitReachedDialog
        open={showLimitDialog}
        onOpenChange={setShowLimitDialog}
        orgId={orgId}
      />
    </>
  );
}
