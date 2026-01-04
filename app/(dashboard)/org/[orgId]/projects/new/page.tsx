"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Plus,
    Users,
    ArrowLeft,
    Check,
    Loader2,
    Layers
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Team {
    id: string;
    name: string;
    memberCount: number;
}

export default function NewProjectPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const orgId = params.orgId as string;

    const initialFolderId = searchParams.get("folderId") || "";

    // Redirect if orgId is literally "undefined"
    if (orgId === "undefined") {
        router.push("/");
    }

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [folderId, setFolderId] = useState(initialFolderId);
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

    // Fetch folders
    const { data: foldersData } = useQuery({
        queryKey: ["folders", orgId],
        queryFn: async () => {
            const res = await fetch(`/api/folders?orgId=${orgId}`);
            if (!res.ok) throw new Error("Failed to fetch folders");
            return res.json() as Promise<{ folders: any[] }>;
        },
    });

    const teams = teamsData?.teams || [];
    const folders = foldersData?.folders || [];

    const createProjectMutation = useMutation({
        mutationFn: async (data: { name: string; description: string; teamIds: string[]; folderId?: string }) => {
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
        if (!name) return;

        createProjectMutation.mutate({
            name,
            description,
            teamIds: selectedTeamIds,
            folderId: folderId && folderId !== "none" ? folderId : undefined,
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

                    {/* Team Selection */}
                    {teams.length > 0 && (
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-[#1a1b1e] flex items-center gap-2">
                                <Users className="h-4 w-4 text-[#7b7c7e]" />
                                Team Access
                            </label>
                            <p className="text-xs text-[#7b7c7e] -mt-1">Select which teams should have access to this project.</p>
                            <div className="grid gap-2 p-3 bg-[#f7f7f5] rounded-lg border border-[#e9e9e9]">
                                {teams.map((team) => (
                                    <label
                                        key={team.id}
                                        className={cn(
                                            "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-all",
                                            selectedTeamIds.includes(team.id)
                                                ? "bg-white border border-[#37352f]/20 shadow-sm"
                                                : "hover:bg-white/50"
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedTeamIds.includes(team.id)}
                                            onChange={() => toggleTeam(team.id)}
                                            className="h-4 w-4 rounded border-[#e9e9e9] text-[#37352f] focus:ring-[#37352f]/10"
                                        />
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-[#1a1b1e]">{team.name}</div>
                                            <div className="text-[11px] text-[#7b7c7e]">{team.memberCount} members</div>
                                        </div>
                                        {selectedTeamIds.includes(team.id) && (
                                            <Check className="h-4 w-4 text-[#37352f]" />
                                        )}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-[#1a1b1e]">Folder (Optional)</label>
                        <Select value={folderId} onValueChange={setFolderId}>
                            <SelectTrigger className="h-11 border-[#e9e9e9] focus:border-[#37352f] focus:ring-1 focus:ring-[#37352f]/10">
                                <SelectValue placeholder="Select a folder to organize this project" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No Folder</SelectItem>
                                {folders.map((f: any) => (
                                    <SelectItem key={f.id} value={f.id}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                                            {f.name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                        disabled={!name || createProjectMutation.isPending}
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
