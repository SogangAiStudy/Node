"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { GraphData } from "@/types";

interface AddEdgeDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddEdgeDialog({ projectId, open, onOpenChange, onSuccess }: AddEdgeDialogProps) {
  const [fromNodeId, setFromNodeId] = useState("");
  const [toNodeId, setToNodeId] = useState("");
  const [relation, setRelation] = useState("DEPENDS_ON");
  const [isLoading, setIsLoading] = useState(false);

  const { data } = useQuery({
    queryKey: ["graph", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/graph`);
      if (!res.ok) throw new Error("Failed to fetch nodes");
      return res.json() as Promise<GraphData>;
    },
    enabled: open,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/edges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromNodeId, toNodeId, relation }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create edge");
      }

      toast.success("Edge created successfully");
      setFromNodeId("");
      setToNodeId("");
      setRelation("DEPENDS_ON");
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create edge");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Edge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <div>
              <Label htmlFor="from">From Node</Label>
              <Select value={fromNodeId} onValueChange={setFromNodeId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select node" />
                </SelectTrigger>
                <SelectContent>
                  {data?.nodes.map((node) => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="relation">Relation</Label>
              <Select value={relation} onValueChange={setRelation}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEPENDS_ON">Depends On</SelectItem>
                  <SelectItem value="HANDOFF_TO">Handoff To</SelectItem>
                  <SelectItem value="NEEDS_INFO_FROM">Needs Info From</SelectItem>
                  <SelectItem value="APPROVAL_BY">Approval By</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="to">To Node</Label>
              <Select value={toNodeId} onValueChange={setToNodeId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select node" />
                </SelectTrigger>
                <SelectContent>
                  {data?.nodes.map((node) => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !fromNodeId || !toNodeId}>
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
