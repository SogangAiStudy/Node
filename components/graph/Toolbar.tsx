import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Filter, Users, X } from "lucide-react";
import { AddNodeDialog } from "./AddNodeDialog";
import { AddEdgeDialog } from "./AddEdgeDialog";
import { cn } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
}

interface ToolbarProps {
  orgId: string;
  projectId: string;
  filterStatus: string;
  onFilterChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTeamIds: string[];
  onTeamChange: (ids: string[]) => void;
  onDataChange: () => void;
}

export function Toolbar({
  orgId,
  projectId,
  filterStatus,
  onFilterChange,
  searchQuery,
  onSearchChange,
  selectedTeamIds,
  onTeamChange,
  onDataChange,
}: ToolbarProps) {
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [addEdgeOpen, setAddEdgeOpen] = useState(false);

  // Fetch teams for the workspace
  const { data: teamsData } = useQuery({
    queryKey: ["teams", orgId],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/teams?orgId=${orgId}`);
      if (!res.ok) throw new Error("Failed to fetch teams");
      return res.json() as Promise<{ teams: Team[] }>;
    },
    enabled: !!orgId,
  });

  const teams = teamsData?.teams || [];

  const toggleTeam = (teamId: string) => {
    if (selectedTeamIds.includes(teamId)) {
      onTeamChange(selectedTeamIds.filter((id) => id !== teamId));
    } else {
      onTeamChange([...selectedTeamIds, teamId]);
    }
  };

  const statusOptions = [
    { value: "ALL", label: "All Status" },
    { value: "TODO", label: "Todo" },
    { value: "DOING", label: "Doing" },
    { value: "WAITING", label: "Waiting" },
    { value: "BLOCKED", label: "Blocked" },
    { value: "DONE", label: "Done" },
  ];

  return (
    <div className="absolute left-6 right-6 top-6 z-20 flex flex-col gap-3">
      {/* Top Row: Actions and Global Filters */}
      <div className="flex items-center gap-4 bg-white/80 backdrop-blur-md border border-[#f1f1ef] p-2.5 rounded-2xl shadow-xl shadow-black/5 transition-all">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7b7c7e]" />
          <Input
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 h-10 border-none bg-[#f7f7f5] focus-visible:ring-0 focus-visible:bg-[#f1f1ef] transition-all rounded-xl text-sm"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 px-3 border-l border-[#f1f1ef]">
          <Filter className="h-3.5 w-3.5 text-[#7b7c7e]" />
          <Select value={filterStatus} onValueChange={onFilterChange}>
            <SelectTrigger className="h-9 w-[130px] border-none bg-transparent focus:ring-0 text-sm font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[#f1f1ef]">
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 border-l border-[#f1f1ef] pl-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-9 px-3 rounded-lg hover:bg-[#f1f1ef] text-[#37352f] gap-2"
            onClick={() => setAddEdgeOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="text-xs font-bold uppercase tracking-wider">Edge</span>
          </Button>
          <Button
            size="sm"
            className="h-9 px-4 rounded-xl bg-[#37352f] hover:bg-[#1a1b1e] text-white gap-2 shadow-sm"
            onClick={() => setAddNodeOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="text-xs font-bold uppercase tracking-wider">Node</span>
          </Button>
        </div>
      </div>

      {/* Bottom Row: Team Tags Filtering */}
      {teams.length > 0 && (
        <div className="flex items-center gap-2 px-1 animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="flex items-center gap-1.5 mr-2 opacity-50">
            <Users className="h-3.5 w-3.5 text-[#37352f]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#37352f]">Teams</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {teams.map((team) => {
              const isSelected = selectedTeamIds.includes(team.id);
              return (
                <Badge
                  key={team.id}
                  variant="outline"
                  className={cn(
                    "px-3 py-1 cursor-pointer transition-all border-[#f1f1ef] hover:border-[#e1e1e1] text-[11px] font-semibold whitespace-nowrap rounded-lg select-none",
                    isSelected
                      ? "bg-[#37352f] text-white border-[#37352f] shadow-md shadow-[#37352f]/10 translate-y-[-1px]"
                      : "bg-white/50 backdrop-blur-sm text-[#37352f] hover:bg-white"
                  )}
                  onClick={() => toggleTeam(team.id)}
                >
                  {team.name}
                  {isSelected && <X className="ml-1.5 h-2.5 w-2.5 opacity-60" />}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AddNodeDialog
        projectId={projectId}
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
