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
import { cn } from "@/lib/utils";
import { TeamDTO } from "@/types";
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
  Layout
} from "lucide-react";
import { AddNodeDialog } from "./AddNodeDialog";
import { AddEdgeDialog } from "./AddEdgeDialog";

interface ToolbarProps {
  projectId: string;
  orgId: string;
  filterStatus: string;
  onFilterChange: (status: string) => void;
  selectedTeamIds: string[];
  onTeamFilterChange: (ids: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onDataChange: () => void;
}

export function Toolbar({
  projectId,
  orgId,
  filterStatus,
  onFilterChange,
  selectedTeamIds,
  onTeamFilterChange,
  searchQuery,
  onSearchChange,
  onDataChange,
}: ToolbarProps) {
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [addEdgeOpen, setAddEdgeOpen] = useState(false);

  const { data: teamsData } = useQuery({
    queryKey: ["project-teams", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/teams`);
      if (!res.ok) throw new Error("Failed to fetch project teams");
      const data = await res.json();
      return data.teams as TeamDTO[];
    },
    enabled: !!projectId,
  });

  const teams = teamsData || [];

  const toggleTeamFilter = (teamId: string) => {
    if (selectedTeamIds.includes(teamId)) {
      onTeamFilterChange(selectedTeamIds.filter((id) => id !== teamId));
    } else {
      onTeamFilterChange([...selectedTeamIds, teamId]);
    }
  };

  const clearAllFilters = () => {
    onTeamFilterChange([]);
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
          {/* Top: Status Filter + Clear */}
          <div className="flex items-center gap-2">
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

            {(selectedTeamIds.length > 0 || filterStatus !== "ALL" || searchQuery) && (
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

          {/* Bottom: Team Filter Badges */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <Users2 className="h-3 w-3" /> Teams
            </div>

            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn(
                  "h-6 px-2.5 cursor-pointer transition-all border-slate-200 text-[12px] font-medium whitespace-nowrap",
                  selectedTeamIds.length === 0
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-transparent text-slate-600 hover:bg-slate-100"
                )}
                onClick={() => onTeamFilterChange([])}
              >
                All Teams
              </Badge>

              {teams.map((team) => (
                <Badge
                  key={team.id}
                  variant="outline"
                  className={cn(
                    "h-6 px-2.5 cursor-pointer transition-all border-slate-200 text-[12px] font-medium whitespace-nowrap group relative",
                    selectedTeamIds.includes(team.id)
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                  )}
                  onClick={() => toggleTeamFilter(team.id)}
                >
                  {team.name}
                  {selectedTeamIds.includes(team.id) && (
                    <X className="ml-1.5 h-3 w-3 opacity-70 group-hover:opacity-100" />
                  )}
                </Badge>
              ))}
            </div>
          </div>
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
    </div>
  );
}
