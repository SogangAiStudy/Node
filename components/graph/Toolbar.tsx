"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddNodeDialog } from "./AddNodeDialog";
import { AddEdgeDialog } from "./AddEdgeDialog";

interface ToolbarProps {
  projectId: string;
  orgId: string;
  filterStatus: string;
  onFilterChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onDataChange: () => void;
}

export function Toolbar({
  projectId,
  orgId,
  filterStatus,
  onFilterChange,
  searchQuery,
  onSearchChange,
  onDataChange,
}: ToolbarProps) {
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [addEdgeOpen, setAddEdgeOpen] = useState(false);

  return (
    <div className="absolute left-4 right-4 top-4 z-10 flex items-center gap-4 rounded-lg bg-white p-4 shadow-md">
      <Button onClick={() => setAddNodeOpen(true)}>Add Node</Button>
      <Button onClick={() => setAddEdgeOpen(true)} variant="outline">
        Add Edge
      </Button>

      <div className="flex-1" />

      <Input
        placeholder="Search nodes..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-64"
      />

      <Select value={filterStatus} onValueChange={onFilterChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Filter" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All</SelectItem>
          <SelectItem value="BLOCKED">Blocked</SelectItem>
          <SelectItem value="WAITING">Waiting</SelectItem>
          <SelectItem value="DOING">Doing</SelectItem>
          <SelectItem value="TODO">Todo</SelectItem>
          <SelectItem value="DONE">Done</SelectItem>
        </SelectContent>
      </Select>

      <AddNodeDialog
        projectId={projectId}
        orgId={orgId}
        open={addNodeOpen}
        onOpenChange={setAddNodeOpen}
        onSuccess={() => {
          onDataChange();
          setAddNodeOpen(false);
        }}
      />

      <AddEdgeDialog
        projectId={projectId}
        open={addEdgeOpen}
        onOpenChange={setAddEdgeOpen}
        onSuccess={() => {
          onDataChange();
          setAddEdgeOpen(false);
        }}
      />
    </div>
  );
}
