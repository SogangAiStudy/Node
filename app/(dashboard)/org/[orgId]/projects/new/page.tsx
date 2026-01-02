"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Plus,
    Users,
    ArrowLeft,
    Check,
    ChevronRight,
    Loader2
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Team {
    id: string;
    name: string;
    memberCount: number;
}

export default function NewProjectPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const orgId = params.orgId as string;

    // Redirect if orgId is literally "undefined"
    if (orgId === "undefined") {
        router.push("/");
    }

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

    // Fetch teams for the workspace
    const { data: teamsData, isLoading: isLoadingTeams } = useQuery({
        queryKey: ["teams", orgId],
        queryFn: async () => {
            const res = await fetch(`/api/organizations/teams?orgId=${orgId}`);
            if (!res.ok) throw new Error("Failed to fetch teams");
            return res.json() as Promise<{ teams: Team[] }>;
        },
    });

    const teams = teamsData?.teams || [];

    const createProjectMutation = useMutation({
        mutationFn: async (data: { name: string; description: string; teamIds: string[] }) => {
            const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to create project");
            }
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["projects", orgId] });
            router.push(`/org/${orgId}/projects/${data.id}/graph`);
        },
    });

    const toggleTeam = (teamId: string) => {
        setSelectedTeamIds(prev =>
            prev.includes(teamId)
                ? prev.filter(id => id !== teamId)
                : [...prev, teamId]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || selectedTeamIds.length === 0) return;

        createProjectMutation.mutate({
            name,
            description,
            teamIds: selectedTeamIds,
        });
    };

    return (
        <div className="max-w-2xl mx-auto py-10 px-4">
            <Link
                href={`/org/${orgId}/projects`}
                className="inline-flex items-center gap-2 text-sm text-[#7b7c7e] hover:text-[#1a1b1e] font-medium mb-8 transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to projects
            </Link>

            <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-bold text-[#1a1b1e] tracking-tight">Create a new project</h1>
                <p className="text-[#7b7c7e]">Set up your workspace and bring in your team to start collaborating.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-[#1a1b1e]">Project Name</label>
                        <Input
                            placeholder="e.g. Q1 Marketing Campaign"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="h-11 border-[#e9e9e9] focus:border-[#37352f] focus:ring-1 focus:ring-[#37352f]/10"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-[#1a1b1e]">Description (Optional)</label>
                        <Textarea
                            placeholder="What is this project about?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="min-h-[100px] border-[#e9e9e9] focus:border-[#37352f] focus:ring-1 focus:ring-[#37352f]/10"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-[#1a1b1e] flex items-center gap-2">
                                <Users className="h-4 w-4" /> Assign Teams
                            </label>
                            <p className="text-xs text-[#7b7c7e]">Select which teams will have access to this project.</p>
                        </div>
                        {selectedTeamIds.length > 0 && (
                            <span className="text-[11px] font-bold bg-[#f1f1ef] text-[#37352f] px-2 py-0.5 rounded uppercase tracking-wider">
                                {selectedTeamIds.length} selected
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {isLoadingTeams ? (
                            <div className="col-span-2 py-8 flex justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-[#7b7c7e]" />
                            </div>
                        ) : teams.length > 0 ? (
                            teams.map((team) => {
                                const isSelected = selectedTeamIds.includes(team.id);
                                return (
                                    <button
                                        key={team.id}
                                        type="button"
                                        onClick={() => toggleTeam(team.id)}
                                        className={cn(
                                            "flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition-all group",
                                            isSelected
                                                ? "border-[#37352f] bg-[#fdfdfd]"
                                                : "border-[#f1f1f1] hover:border-[#e1e1e1] bg-white"
                                        )}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={cn(
                                                "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                                                isSelected ? "bg-[#37352f] text-white" : "bg-[#f1f1ef] text-[#7b7c7e]"
                                            )}>
                                                {team.name[0]}
                                            </div>
                                            <div className="truncate">
                                                <div className="text-sm font-semibold truncate leading-tight">{team.name}</div>
                                                <div className="text-[11px] text-[#7b7c7e] flex items-center gap-1">
                                                    {team.memberCount} members
                                                </div>
                                            </div>
                                        </div>
                                        {isSelected ? (
                                            <div className="bg-[#37352f] rounded-full p-0.5 shrink-0">
                                                <Check className="h-3 w-3 text-white" />
                                            </div>
                                        ) : (
                                            <div className="w-4 h-4 rounded-full border border-[#e1e1e1] shrink-0 group-hover:bg-[#f1f1f1]" />
                                        )}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="col-span-2 py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-sm text-gray-500 mb-2">No teams found in this workspace.</p>
                                <Link href={`/org/${orgId}/settings`} className="text-sm font-medium text-[#37352f] hover:underline">
                                    Create a team first
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-4 border-t border-[#f1f1f1] flex items-center justify-end gap-3">
                    <Button
                        variant="ghost"
                        type="button"
                        onClick={() => router.back()}
                        disabled={createProjectMutation.isPending}
                        className="h-11 px-6 font-medium text-[#7b7c7e]"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={!name || selectedTeamIds.length === 0 || createProjectMutation.isPending}
                        className="h-11 px-8 rounded-xl bg-[#37352f] hover:bg-[#1a1b1e] text-white font-semibold transition-all shadow-md shadow-[#37352f]/10"
                    >
                        {createProjectMutation.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            "Create Project"
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
