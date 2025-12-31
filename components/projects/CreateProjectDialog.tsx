"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Team {
  id: string;
  name: string;
}

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateProjectDialog({ open, onOpenChange, onSuccess }: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [primaryTeamId, setPrimaryTeamId] = useState<string>("");
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTeams();
    }
  }, [open]);

  const fetchTeams = async () => {
    setIsLoadingTeams(true);
    try {
      const res = await fetch("/api/organizations/teams");
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams);
        if (data.teams.length > 0) {
          setSelectedTeamIds([data.teams[0].id]);
          setPrimaryTeamId(data.teams[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch teams", err);
    } finally {
      setIsLoadingTeams(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTeamIds.length === 0) {
      toast.error("Please select at least one team");
      return;
    }
    setIsLoading(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          teamIds: selectedTeamIds,
          primaryTeamId: primaryTeamId || selectedTeamIds[0]
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create project");
      }

      toast.success("Project created successfully");
      setName("");
      setDescription("");
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create project");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>Create a new collaboration project and assign teams.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q1 Roadmap"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project about?"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-3">
              <Label>Team Access</Label>
              {isLoadingTeams ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-2 border rounded-md p-3 max-h-40 overflow-y-auto">
                  {teams.map((team) => (
                    <div key={team.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`project-team-${team.id}`}
                        checked={selectedTeamIds.includes(team.id)}
                        onCheckedChange={() => toggleTeam(team.id)}
                      />
                      <label
                        htmlFor={`project-team-${team.id}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {team.name}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedTeamIds.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="primaryTeam">Primary Team</Label>
                <Select value={primaryTeamId} onValueChange={setPrimaryTeamId}>
                  <SelectTrigger id="primaryTeam">
                    <SelectValue placeholder="Select primary team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.filter(t => selectedTeamIds.includes(t.id)).map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground italic">
                  The primary team is set as the initial project administrator.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || selectedTeamIds.length === 0}>
              {isLoading ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
