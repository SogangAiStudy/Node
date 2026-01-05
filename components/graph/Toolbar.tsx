import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Node, Edge } from "reactflow";
import { cn } from "@/lib/utils";
import { TeamDTO, NodeDTO } from "@/types";
import {
  Plus,
  Search,
  Filter,
  X,
  Users2,
  CheckCircle2,
  Clock,
  AlertCircle,
  PlayCircle,
  Layout,
  Sparkles,
  Layers,
} from "lucide-react";
import { AddNodeDialog } from "./AddNodeDialog";
import { AddEdgeDialog } from "./AddEdgeDialog";
import { GenerateNodesDialog } from "./GenerateNodesDialog";
import { OrganizeDialog } from "./OrganizeDialog";

interface Team {
  id: string;
  name: string;
}

interface ToolbarProps {
  orgId: string;
  projectId: string;
  filterStatus: string;
  onFilterChange: (status: string) => void;
  selectedTeamIds: string[];
  onTeamFilterChange: (ids: string[]) => void;
  selectedUserIds: string[];
  onUserFilterChange: (ids: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onDataChange: () => void;
  nodes: Node[];
  edges: Edge[];
  onOrganizeApply: (positions: Array<{ nodeId: string; x: number; y: number }>) => void;
}

export function Toolbar({
  orgId,
  projectId,
  filterStatus,
  onFilterChange,
  selectedTeamIds,
  onTeamFilterChange,
  selectedUserIds,
  onUserFilterChange,
  searchQuery,
  onSearchChange,
  onDataChange,
  nodes,
  edges,
  onOrganizeApply,
}: ToolbarProps) {
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [addEdgeOpen, setAddEdgeOpen] = useState(false);
  const [generateNodesOpen, setGenerateNodesOpen] = useState(false);
  const [autoOrganizeOpen, setAutoOrganizeOpen] = useState(false);

  const { data: teamsData } = useQuery({
    queryKey: ["project-teams", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/teams`);
      if (!res.ok) throw new Error("Failed to fetch project teams");
      const data = await res.json();
      return (data.teams || []) as TeamDTO[];
    },
    enabled: !!projectId,
  });

  const { data: membersData } = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (!res.ok) throw new Error("Failed to fetch project members");
      const data = await res.json();
      return (data.members || []).map((m: any) => ({ id: m.userId, name: m.userName }));
    },
    enabled: !!projectId,
  });

  const teams = teamsData || [];
  const members = membersData || [];

  const toggleTeamFilter = (teamId: string) => {
    if (selectedTeamIds.includes(teamId)) {
      onTeamFilterChange(selectedTeamIds.filter((id) => id !== teamId));
    } else {
      onTeamFilterChange([...selectedTeamIds, teamId]);
    }
  };

  const toggleUserFilter = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onUserFilterChange(selectedUserIds.filter((id) => id !== userId));
    } else {
      onUserFilterChange([...selectedUserIds, userId]);
    }
  };

  const clearAllFilters = () => {
    onTeamFilterChange([]);
    onUserFilterChange([]);
    onFilterChange("ALL");
    onSearchChange("");
  };

  return (
    <div className="absolute left-4 right-4 top-4 z-10 flex flex-col gap-3 rounded-xl bg-white/80 backdrop-blur-md p-3 shadow-lg border border-slate-200">
      {/* Single Row: Actions on Left, Filters on Right */}
      <div className="flex items-center justify-between gap-3">
        {/* Left Side: Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setAddNodeOpen(true)}
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Node
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddEdgeOpen(true)}
              className="h-8 border-slate-200"
            >
              <Layout className="h-4 w-4 mr-1.5" />
              Connect
            </Button>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {/* AI Features */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setGenerateNodesOpen(true)}
              className="h-8 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 hover:border-purple-300"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Generate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAutoOrganizeOpen(true)}
              className="h-8 border-slate-200 text-slate-600 hover:text-slate-800"
            >
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              Organize
            </Button>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div className="relative group">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <Input
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 pl-9 bg-slate-50 border-transparent focus:bg-white focus:border-blue-200 transition-all text-sm w-full max-w-[300px]"
            />
          </div>
        </div>

        {/* Right Side: All Filters */}
        <div className="flex flex-col gap-2 items-end">
          {/* Top: Person Filter + Status Filter + Clear */}
          <div className="flex items-center gap-2">
            {/* Person Filter */}
            <Select
              value={selectedUserIds.length === 1 ? selectedUserIds[0] : selectedUserIds.length > 0 ? "MULTIPLE" : "ALL"}
              onValueChange={(value) => {
                if (value === "ALL") {
                  onUserFilterChange([]);
                } else if (value !== "MULTIPLE") {
                  toggleUserFilter(value);
                }
              }}
            >
              <SelectTrigger className="h-8 w-[140px] bg-slate-50 border-transparent transition-all hover:bg-slate-100">
                <div className="flex items-center gap-2">
                  <Users2 className="h-3.5 w-3.5 text-slate-500" />
                  <SelectValue placeholder="All People">
                    {selectedUserIds.length === 0 ? "All People" : selectedUserIds.length === 1 ? members.find(m => m.id === selectedUserIds[0])?.name : `${selectedUserIds.length} people`}
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All People</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={onFilterChange}>
              <SelectTrigger className="h-8 w-[130px] bg-slate-50 border-transparent transition-all hover:bg-slate-100">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-slate-500" />
                  <SelectValue placeholder="Status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="BLOCKED">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" /> Blocked
                  </div>
                </SelectItem>
                <SelectItem value="TODO">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-slate-400" /> Todo
                  </div>
                </SelectItem>
                <SelectItem value="DOING">
                  <div className="flex items-center gap-2">
                    <PlayCircle className="h-3.5 w-3.5 text-blue-500" /> Doing
                  </div>
                </SelectItem>
                <SelectItem value="DONE">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Done
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {(selectedUserIds.length > 0 || selectedTeamIds.length > 0 || filterStatus !== "ALL" || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-8 text-slate-500 hover:text-red-500 hover:bg-red-50"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Bottom: Person/Team Filter Badges */}
          {teams.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end max-w-[400px]">
              {teams.map((team) => (
                <Badge
                  key={team.id}
                  variant={selectedTeamIds.includes(team.id) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer text-xs h-6 transition-all",
                    selectedTeamIds.includes(team.id)
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "border-slate-200 hover:border-purple-400 hover:bg-purple-50 text-slate-600"
                  )}
                  onClick={() => toggleTeamFilter(team.id)}
                >
                  <Users2 className="h-3 w-3 mr-1" />
                  {team.name}
                </Badge>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Dialogs */}
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

      <GenerateNodesDialog
        projectId={projectId}
        orgId={orgId}
        open={generateNodesOpen}
        onOpenChange={setGenerateNodesOpen}
        onSuccess={() => {
          onDataChange();
          setGenerateNodesOpen(false);
        }}
      />

      <OrganizeDialog
        projectId={projectId}
        nodes={nodes.map(n => ({
          id: n.id,
          title: n.data.node.title,
          phase: n.data.node.phase,
          width: n.width || n.data.width,
          height: n.height || n.data.height
        }))}
        edges={edges.map(e => ({ id: e.id, source: e.source, target: e.target }))}
        open={autoOrganizeOpen}
        onOpenChange={setAutoOrganizeOpen}
        onApply={onOrganizeApply}
      />
    </div>
  );
}
