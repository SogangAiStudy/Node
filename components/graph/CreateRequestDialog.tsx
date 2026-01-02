"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useCompletion } from "@ai-sdk/react";
import { Loader2, Sparkles, User } from "lucide-react";

interface CreateRequestDialogProps {
  projectId: string;
  linkedNodeId: string;
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

interface NodeData {
  owners: { id: string; name: string }[];
  teams: { id: string; name: string }[];
}

export function CreateRequestDialog({
  projectId,
  linkedNodeId,
  open,
  onOpenChange,
  onSuccess,
}: CreateRequestDialogProps) {
  const [question, setQuestion] = useState("");
  const [toUserId, setToUserId] = useState("");
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

  // Data fetching state
  const [members, setMembers] = useState<Member[]>([]);
  const [nodeData, setNodeData] = useState<NodeData | null>(null);

  // Fetch project members, teams, and node data
  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      try {
        // Fetch project members and teams
        const membersRes = await fetch(`/api/projects/${projectId}/members`);
        if (membersRes.ok) {
          const data = await membersRes.json();
          setMembers(data.members || []);
        }

        // Fetch node data to get owners
        const nodeRes = await fetch(`/api/nodes/${linkedNodeId}`);
        if (nodeRes.ok) {
          const node = await nodeRes.json();
          setNodeData({
            owners: node.owners || [],
            teams: node.teams || [],
          });
        }
      } catch (error) {
        console.error("Failed to fetch request dialog data:", error);
      }
    };

    fetchData();
  }, [open, projectId, linkedNodeId]);

  const handleAutoDraft = async () => {
    if (!linkedNodeId) return;
    try {
      await complete("", {
        body: {
          nodeId: linkedNodeId,
          recipientId: toUserId || undefined,
          context: question // Send current text as context 
        }
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Effect to update the textarea as stream comes in
  if (isDrafting && completion) {
    if (question !== completion) {
      setQuestion(completion);
    }
  }

  // Get suggested users (node owners first, then other team members)
  const suggestedUsers = members
    .map((m) => ({
      id: m.userId,
      name: m.userName || "Unknown",
      teamName: m.teamName,
      isOwner: nodeData?.owners.some((o) => o.id === m.userId) || false,
    }))
    .sort((a, b) => {
      // Owners first
      if (a.isOwner && !b.isOwner) return -1;
      if (!a.isOwner && b.isOwner) return 1;
      return 0;
    });


  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const body: Record<string, string> = {
        linkedNodeId,
        question,
      };

      if (!toUserId) {
        throw new Error("Please select a person to send this request to");
      }
      body.toUserId = toUserId;

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
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create request");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
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
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="toUserId">Request To</Label>
              <Select value={toUserId} onValueChange={setToUserId}>
                <SelectTrigger className="mt-2 text-left h-10">
                  <SelectValue placeholder="Select a person..." />
                </SelectTrigger>
                <SelectContent>
                  {suggestedUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[9px] bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {user.name}
                            {user.isOwner && (
                              <span className="ml-2 text-xs text-blue-600 font-semibold">
                                (Owner)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                  {suggestedUsers.length === 0 && (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      No members available
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
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
