"use client";

import { useState } from "react";
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
import { toast } from "sonner";

interface CreateRequestDialogProps {
  projectId: string;
  linkedNodeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateRequestDialog({
  projectId,
  linkedNodeId,
  open,
  onOpenChange,
  onSuccess,
}: CreateRequestDialogProps) {
  const [question, setQuestion] = useState("");
  const [targetType, setTargetType] = useState<"user" | "team">("user");
  const [toUserId, setToUserId] = useState("");
  const [toTeam, setToTeam] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const body: Record<string, string> = {
        linkedNodeId,
        question,
      };

      if (targetType === "user" && toUserId) {
        body.toUserId = toUserId;
      } else if (targetType === "team" && toTeam) {
        body.toTeam = toTeam;
      } else {
        throw new Error("Please provide either a user ID or team name");
      }

      const res = await fetch(`/api/projects/${projectId}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create request");
      }

      toast.success("Request created successfully");
      setQuestion("");
      setToUserId("");
      setToTeam("");
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create request");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <div>
              <Label htmlFor="question">Question</Label>
              <Textarea
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
                className="mt-2"
                placeholder="What information do you need?"
              />
            </div>
            <div>
              <Label>Request To</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={targetType === "user"}
                    onChange={() => setTargetType("user")}
                  />
                  <span>User</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={targetType === "team"}
                    onChange={() => setTargetType("team")}
                  />
                  <span>Team</span>
                </label>
              </div>
            </div>
            {targetType === "user" ? (
              <div>
                <Label htmlFor="toUserId">User ID</Label>
                <Input
                  id="toUserId"
                  value={toUserId}
                  onChange={(e) => setToUserId(e.target.value)}
                  className="mt-2"
                  placeholder="Enter user ID"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="toTeam">Team Name</Label>
                <Input
                  id="toTeam"
                  value={toTeam}
                  onChange={(e) => setToTeam(e.target.value)}
                  className="mt-2"
                  placeholder="Enter team name"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
