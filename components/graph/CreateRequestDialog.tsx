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
import { useCompletion } from "@ai-sdk/react";
import { Loader2, Sparkles } from "lucide-react";

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

  // AI Streaming Hook
  const { complete, completion, isLoading: isDrafting, setCompletion } = useCompletion({
    api: "/api/ai/draft-request",
    onFinish: (_, result) => {
      setQuestion(result);
      toast.success("Draft generated!");
    },
    onError: (err) => {
      toast.error("Failed to generate draft: " + err.message);
    }
  });

  // Sync completion to question state while streaming
  // We can't easily sync state *during* stream without a useEffect or controlled input.
  // Actually, useCompletion gives us `completion`. We can just use that to update `question` when done, 
  // or show it in the UI. 
  // BETTER UX: Let's just update `question` directly via `input` which `useCompletion` supports,
  // OR manually call `complete`.

  const handleAutoDraft = async () => {
    if (!linkedNodeId) return;
    try {
      await complete("", {
        body: {
          nodeId: linkedNodeId,
          recipientId: targetType === 'user' ? toUserId : undefined,
          context: question // Send current text as context 
        }
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Effect to update the textarea as stream comes in
  // NOTE: This overrides user input while streaming.
  if (isDrafting && completion) {
    if (question !== completion) {
      setQuestion(completion);
    }
  }

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
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="question">Question</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                  onClick={handleAutoDraft}
                  disabled={isDrafting}
                >
                  {isDrafting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  {isDrafting ? "Drafting..." : "Auto-Draft"}
                </Button>
              </div>
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
