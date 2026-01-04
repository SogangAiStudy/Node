"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Check,
    Copy,
    Mail,
    MoreHorizontal,
    Plus,
    Search,
    Users,
    X,
    UserPlus
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProjectSettingsDialogProps {
    projectId: string;
    orgId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultTab?: "members" | "teams";
}

export function ProjectSettingsDialog({
    projectId,
    orgId,
    open,
    onOpenChange,
    defaultTab = "members",
}: ProjectSettingsDialogProps) {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("EDITOR");
    const [selectedTeam, setSelectedTeam] = useState<string>("");

    useEffect(() => {
        if (open) setActiveTab(defaultTab);
    }, [open, defaultTab]);

    // Fetch Access Data
    const { data: accessData, isLoading } = useQuery({
        queryKey: ["project-access", projectId],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/access`);
            if (!res.ok) throw new Error("Failed to load access data");
            return res.json();
        },
        enabled: open,
    });

    // Invite Mutation
    const inviteMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/invites`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to invite");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Invite sent");
            setInviteEmail("");
            queryClient.invalidateQueries({ queryKey: ["project-access", projectId] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    // Add Team Mutation
    const addTeamMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/teams`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId: selectedTeam, role: "EDITOR" }), // Default to EDITOR
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to add team");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Team added");
            setSelectedTeam("");
            queryClient.invalidateQueries({ queryKey: ["project-access", projectId] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    // Revoke Invite
    const revokeMutation = useMutation({
        mutationFn: async (inviteId: string) => {
            const res = await fetch(`/api/projects/${projectId}/invites/${inviteId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error("Failed to revoke invite");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Invite revoked");
            queryClient.invalidateQueries({ queryKey: ["project-access", projectId] });
        },
        onError: () => toast.error("Failed to revoke invite"),
    });

    // Remove Member
    const removeMemberMutation = useMutation({
        mutationFn: async (userId: string) => {
            const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to remove member");
            return data;
        },
        onSuccess: () => {
            toast.success("Member removed");
            queryClient.invalidateQueries({ queryKey: ["project-access", projectId] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    // Update Role
    const updateRoleMutation = useMutation({
        mutationFn: async ({ userId, role }: { userId: string, role: string }) => {
            const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update role");
            return data;
        },
        onSuccess: () => {
            toast.success("Role updated");
            queryClient.invalidateQueries({ queryKey: ["project-access", projectId] });
        },
        onError: (err: any) => toast.error(err.message),
    });

    // Remove Team
    const removeTeamMutation = useMutation({
        mutationFn: async (teamId: string) => {
            const res = await fetch(`/api/projects/${projectId}/teams/${teamId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error("Failed to remove team");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Team removed");
            queryClient.invalidateQueries({ queryKey: ["project-access", projectId] });
        },
        onError: () => toast.error("Failed to remove team"),
    });

    const isLoadingAction = inviteMutation.isPending || addTeamMutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md md:max-w-lg p-0 gap-0 overflow-hidden bg-white dark:bg-zinc-950">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle className="text-lg font-medium">Share Project</DialogTitle>
                </DialogHeader>

                <div className="p-4 space-y-4">
                    {/* Quick Invite Section */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Email address"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                className="pl-9 bg-muted/30"
                            />
                        </div>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                            <SelectTrigger className="w-[110px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="VIEWER">Viewer</SelectItem>
                                <SelectItem value="EDITOR">Editor</SelectItem>
                                <SelectItem value="PROJECT_ADMIN">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            onClick={() => inviteMutation.mutate()}
                            disabled={!inviteEmail || isLoadingAction}
                        >
                            Invite
                        </Button>
                    </div>

                    {/* Public Link Logic */}
                    <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                <Search className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-foreground font-medium">Anyone with the link</span>
                                <span className="text-xs">Can view</span>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={() => {
                                const link = `${window.location.origin}/org/${orgId}/projects/${projectId}/graph`;
                                navigator.clipboard.writeText(link);
                                toast.success("Link copied");
                            }}
                        >
                            <Copy className="h-3.5 w-3.5" />
                            Copy link
                        </Button>
                    </div>
                </div>

                <Separator />

                <Tabs
                    defaultValue="members"
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as any)}
                    className="w-full"
                >
                    <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6 py-0 h-10">
                        <TabsTrigger
                            value="members"
                            className="rounded-none border-b-2 border-transparent px-4 pb-2 pt-2 font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground shadow-none bg-transparent"
                        >
                            Members
                        </TabsTrigger>
                        <TabsTrigger
                            value="teams"
                            className="rounded-none border-b-2 border-transparent px-4 pb-2 pt-2 font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground shadow-none bg-transparent"
                        >
                            Teams
                        </TabsTrigger>
                    </TabsList>

                    <ScrollArea className="h-[300px]">
                        <TabsContent value="members" className="m-0 p-0">
                            <div className="flex flex-col">
                                {isLoading && <div className="p-8 text-center text-sm text-muted-foreground">Loading members...</div>}

                                {/* Invites */}
                                {accessData?.invites?.length > 0 && (
                                    <div className="px-4 py-2 bg-muted/20">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Pending Invites</h4>
                                        {accessData.invites.map((inv: any) => (
                                            <div key={inv.id} className="flex items-center justify-between py-2 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-8 w-8 rounded-full bg-zinc-100 border flex items-center justify-center">
                                                        <Mail className="h-4 w-4 text-zinc-500" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-zinc-700">{inv.email}</span>
                                                        <span className="text-xs text-muted-foreground">Invited by {inv.invitedBy}</span>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-red-500 hover:bg-red-50"
                                                    onClick={() => revokeMutation.mutate(inv.id)}
                                                    disabled={revokeMutation.isPending}
                                                >
                                                    Revoke
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Members */}
                                <div className="p-2">
                                    {accessData?.members?.map((member: any) => (
                                        <div key={member.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={member.image} />
                                                    <AvatarFallback>{member.name?.[0] || "U"}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm text-foreground">{member.name}</span>
                                                    <span className="text-xs text-muted-foreground">{member.email}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Select
                                                    defaultValue={member.role}
                                                    onValueChange={(val) => updateRoleMutation.mutate({ userId: member.userId, role: val })}
                                                >
                                                    <SelectTrigger className="h-7 w-[100px] text-xs border-0 bg-transparent focus:ring-0">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="VIEWER">Viewer</SelectItem>
                                                        <SelectItem value="EDITOR">Editor</SelectItem>
                                                        <SelectItem value="PROJECT_ADMIN">Admin</SelectItem>
                                                    </SelectContent>
                                                </Select>

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => removeMemberMutation.mutate(member.userId)}
                                                    title="Remove member"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="teams" className="m-0 p-4">
                            <div className="space-y-4">
                                {/* Add Team */}
                                <div className="flex items-center gap-2">
                                    <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder="Select a team to add..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {accessData?.availableTeams?.map((t: any) => (
                                                <SelectItem key={t.id} value={t.id}>
                                                    {t.name} ({t.memberCount} members)
                                                </SelectItem>
                                            ))}
                                            {accessData?.availableTeams?.length === 0 && (
                                                <div className="p-2 text-xs text-muted-foreground text-center">No available teams</div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        disabled={!selectedTeam || isLoadingAction}
                                        onClick={() => addTeamMutation.mutate()}
                                        variant="secondary"
                                    >
                                        <Plus className="h-4 w-4 mr-1.5" />
                                        Add
                                    </Button>
                                </div>

                                <div className="space-y-1">
                                    {accessData?.teams?.map((team: any) => (
                                        <div key={team.id} className="flex items-center justify-between p-2 border rounded-md">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 bg-blue-50 text-blue-600 rounded flex items-center justify-center">
                                                    <Users className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{team.name}</p>
                                                    <p className="text-xs text-muted-foreground">{team.memberCount} members • {team.role}</p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-red-500 hover:bg-red-50"
                                                onClick={() => removeTeamMutation.mutate(team.id)}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </TabsContent>
                    </ScrollArea>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
