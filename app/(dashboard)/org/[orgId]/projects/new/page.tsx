"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    ArrowLeft,
    Check,
    Loader2,
    Users2,
    Layout,
    User
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Team {
    id: string;
    name: string;
    memberCount: number;
}

interface Member {
    userId: string;
    userName: string | null;
    userEmail: string;
    teamName: string | null;
}

export default function NewProjectPage() {
    const { data: session } = useSession();
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const orgId = params.orgId as string;

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

    // Fetch teams for the workspace
    const { data: teamsData, isLoading: isLoadingTeams } = useQuery({
        queryKey: ["teams", orgId],
        queryFn: async () => {
            const res = await fetch(`/api/organizations/teams?orgId=${orgId}`);
            if (!res.ok) throw new Error("Failed to fetch teams");
            return res.json() as Promise<{ teams: Team[] }>;
        },
        enabled: !!orgId,
    });

    // Fetch members for the workspace
    const { data: membersData, isLoading: isLoadingMembers } = useQuery({
        queryKey: ["members", orgId],
        queryFn: async () => {
            const res = await fetch(`/api/organizations/members?orgId=${orgId}`);
            if (!res.ok) throw new Error("Failed to fetch members");
            return res.json() as Promise<{ members: Member[] }>;
        },
        enabled: !!orgId,
    });

    const teams = teamsData?.teams || [];
    const members = membersData?.members || [];

    // Auto-select current user as a member by default
    useEffect(() => {
        if (session?.user?.id && members.length > 0 && selectedMemberIds.length === 0) {
            const currentUserIsMember = members.some(m => m.userId === session.user.id);
            if (currentUserIsMember) {
                setSelectedMemberIds([session.user.id]);
            }
        }
    }, [session?.user?.id, members, selectedMemberIds.length]);

    const createProjectMutation = useMutation({
        mutationFn: async (data: { name: string; description: string; teamIds: string[]; memberIds: string[]; orgId: string }) => {
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

    const toggleMember = (memberId: string) => {
        setSelectedMemberIds(prev =>
            prev.includes(memberId)
                ? prev.filter(id => id !== memberId)
                : [...prev, memberId]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || selectedTeamIds.length === 0) return;

        createProjectMutation.mutate({
            name,
            description,
            teamIds: selectedTeamIds,
            memberIds: selectedMemberIds,
            orgId
        });
    };

    const getInitials = (name: string | null) => {
        if (!name) return "?";
        return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    };

    return (
        <div className="max-w-[700px] mx-auto transition-all animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Link
                href={`/org/${orgId}/projects`}
                className="inline-flex items-center gap-2 text-sm text-[#7b7c7e] hover:text-[#1a1b1e] font-medium mb-12 transition-colors group"
            >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Back to projects
            </Link>

            <div className="space-y-3 mb-12">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-[#f1f1ef] rounded-xl text-[#37352f]">
                        <Layout className="h-6 w-6" />
                    </div>
                    <h1 className="text-4xl font-bold text-[#1a1b1e] tracking-tight">Create project</h1>
                </div>
                <p className="text-[#7b7c7e] text-lg leading-relaxed">
                    Initialize a new workspace and organize your teams to map out your vision.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-12">
                <div className="space-y-8">
                    <div className="space-y-3">
                        <label className="text-[13px] font-bold text-[#7b7c7e] uppercase tracking-wider">Project Name</label>
                        <Input
                            placeholder="e.g. Next-Gen Interface Design"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="h-14 text-xl border-none bg-[#f7f7f5] focus-visible:ring-0 focus-visible:bg-[#f1f1ef] transition-all rounded-xl px-5"
                            required
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-[13px] font-bold text-[#7b7c7e] uppercase tracking-wider">Description (Optional)</label>
                        <Textarea
                            placeholder="What are you building? Define the scope of your work..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="min-h-[140px] border-none bg-[#f7f7f5] focus-visible:ring-0 focus-visible:bg-[#f1f1ef] transition-all rounded-xl p-5 text-base leading-relaxed resize-none"
                        />
                    </div>
                </div>

                {/* Assign People Section */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-[#f1f1ef] pb-4">
                        <div className="space-y-1">
                            <label className="text-[13px] font-bold text-[#1a1b1e] flex items-center gap-2 uppercase tracking-wider">
                                <User className="h-4 w-4 text-[#7b7c7e]" /> Assign People
                            </label>
                            <p className="text-[13px] text-[#7b7c7e]">Individual members with access to this project.</p>
                        </div>
                        {selectedMemberIds.length > 0 && (
                            <span className="text-[11px] font-bold bg-[#37352f] text-white px-2.5 py-1 rounded-full uppercase tracking-wider">
                                {selectedMemberIds.length} Selected
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {isLoadingMembers ? (
                            <div className="col-span-2 py-12 flex justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-[#7b7c7e] opacity-40" />
                            </div>
                        ) : members.length > 0 ? (
                            members.map((member) => {
                                const isSelected = selectedMemberIds.includes(member.userId);
                                const isCurrentUser = session?.user?.id === member.userId;
                                return (
                                    <button
                                        key={member.userId}
                                        type="button"
                                        onClick={() => toggleMember(member.userId)}
                                        className={cn(
                                            "flex items-center gap-3 p-4 rounded-xl border-2 transition-all group relative overflow-hidden",
                                            isSelected
                                                ? "border-[#37352f] bg-[#37352f] text-white shadow-md shadow-[#37352f]/10"
                                                : "border-[#f1f1ef] hover:border-[#e1e1e1] bg-white text-[#37352f]"
                                        )}
                                    >
                                        <Avatar className={cn(
                                            "h-9 w-9 border-2",
                                            isSelected ? "border-white/30" : "border-[#f1f1ef]"
                                        )}>
                                            <AvatarFallback className={cn(
                                                "text-xs font-bold",
                                                isSelected ? "bg-white/20 text-white" : "bg-[#f1f1ef] text-[#7b7c7e]"
                                            )}>
                                                {getInitials(member.userName)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="text-left flex-1 min-w-0">
                                            <div className="text-[13px] font-bold truncate leading-tight">
                                                {member.userName || member.userEmail}
                                                {isCurrentUser && <span className="ml-1.5 opacity-60">(You)</span>}
                                            </div>
                                            <div className={cn(
                                                "text-[11px] opacity-60 truncate",
                                                isSelected ? "text-white" : "text-[#7b7c7e]"
                                            )}>
                                                {member.teamName || "No team"}
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <div className="bg-white rounded-full p-0.5 shrink-0">
                                                <Check className="h-3 w-3 text-[#37352f]" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="col-span-2 py-12 text-center bg-[#f7f7f5] rounded-2xl border border-dashed border-[#e1e1e1]">
                                <p className="text-[#7b7c7e] text-[15px]">No members available in this workspace.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Assign Teams Section */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-[#f1f1ef] pb-4">
                        <div className="space-y-1">
                            <label className="text-[13px] font-bold text-[#1a1b1e] flex items-center gap-2 uppercase tracking-wider">
                                <Users2 className="h-4 w-4 text-[#7b7c7e]" /> Assign Teams
                            </label>
                            <p className="text-[13px] text-[#7b7c7e]">Teams with access to this project.</p>
                        </div>
                        {selectedTeamIds.length > 0 && (
                            <span className="text-[11px] font-bold bg-[#37352f] text-white px-2.5 py-1 rounded-full uppercase tracking-wider">
                                {selectedTeamIds.length} Selected
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {isLoadingTeams ? (
                            <div className="col-span-2 py-12 flex justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-[#7b7c7e] opacity-40" />
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
                                            "flex items-center justify-between p-5 rounded-2xl border-2 transition-all group relative overflow-hidden",
                                            isSelected
                                                ? "border-[#37352f] bg-[#37352f] text-white shadow-lg shadow-[#37352f]/10"
                                                : "border-[#f1f1ef] hover:border-[#e1e1e1] bg-white text-[#37352f]"
                                        )}
                                    >
                                        <div className="flex items-center gap-4 relative z-10">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-colors",
                                                isSelected ? "bg-white/20 text-white" : "bg-[#f1f1ef] text-[#7b7c7e]"
                                            )}>
                                                {team.name[0]}
                                            </div>
                                            <div className="text-left">
                                                <div className="text-[15px] font-bold truncate leading-tight">{team.name}</div>
                                                <div className={cn(
                                                    "text-[12px] opacity-60",
                                                    isSelected ? "text-white" : "text-[#7b7c7e]"
                                                )}>
                                                    {team.memberCount} members
                                                </div>
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <div className="bg-white rounded-full p-1 relative z-10">
                                                <Check className="h-3 w-3 text-[#37352f]" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="col-span-2 py-12 text-center bg-[#f7f7f5] rounded-2xl border border-dashed border-[#e1e1e1]">
                                <p className="text-[#7b7c7e] text-[15px] mb-4">No teams available in this workspace.</p>
                                <Button variant="outline" asChild className="rounded-xl border-[#e1e1e1]">
                                    <Link href={`/org/${orgId}/settings`}>Configure Teams</Link>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-8 border-t border-[#f1f1ef] flex items-center justify-end gap-4">
                    <Button
                        variant="ghost"
                        type="button"
                        onClick={() => router.back()}
                        disabled={createProjectMutation.isPending}
                        className="h-12 px-8 text-[#7b7c7e] hover:text-[#1a1b1e] hover:bg-[#f1f1ef] rounded-xl font-medium"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={!name || selectedTeamIds.length === 0 || createProjectMutation.isPending}
                        className="h-12 px-10 rounded-xl bg-[#37352f] hover:bg-[#1a1b1e] text-white font-bold transition-all shadow-xl shadow-[#37352f]/20 disabled:opacity-30"
                    >
                        {createProjectMutation.isPending ? (
                            <>
                                <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                                Initializing...
                            </>
                        ) : (
                            "Initialize Project"
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
