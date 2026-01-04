"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
    Loader2,
    Settings2,
    Users,
    Plus,
    Check,
    X,
    ShieldAlert,
    Copy,
    CheckCircle2,
    Trash2,
    Shield,
    UserCircle,
    Settings as SettingsIcon,
    ArrowLeft
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Member {
    id: string;
    userId: string;
    name: string;
    email: string;
    image: string | null;
    role: "ADMIN" | "MEMBER";
    status: "ACTIVE" | "PENDING_TEAM_ASSIGNMENT" | "DEACTIVATED" | "PENDING_APPROVAL";
    teams: Array<{ id: string; name: string; role: string }>;
    joinedAt: string;
}

interface Team {
    id: string;
    name: string;
    description: string | null;
    memberCount: number;
}

interface Organization {
    id: string;
    name: string;
    inviteCode: string | null;
    role: string;
}

export default function WorkspaceSettingsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const orgId = params.orgId as string;
    const initialTab = searchParams.get("tab") || "general";

    // UI State
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [createTeamOpen, setCreateTeamOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    // Workspace Edit State
    const [workspaceName, setWorkspaceName] = useState("");

    // Member Edit State
    const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
    const [selectedRole, setSelectedRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
    const [selectedStatus, setSelectedStatus] = useState<string>("");

    // Team Creation State
    const [newTeamName, setNewTeamName] = useState("");
    const [newTeamDescription, setNewTeamDescription] = useState("");

    // --- Queries ---

    const { data: orgData, isLoading: loadingOrg } = useQuery({
        queryKey: ["organization", orgId],
        queryFn: async () => {
            const res = await fetch(`/api/organizations/${orgId}`);
            if (!res.ok) throw new Error("Failed to fetch organization");
            const data = await res.json();
            setWorkspaceName(data.organization.name);
            return data.organization as Organization;
        },
        enabled: !!orgId,
    });

    const { data: members, isLoading: loadingMembers } = useQuery({
        queryKey: ["org-members", orgId],
        queryFn: async () => {
            const res = await fetch(`/api/organizations/members?orgId=${orgId}`);
            if (!res.ok) throw new Error("Failed to fetch members");
            const data = await res.json();
            return data.members as Member[];
        },
        enabled: !!orgId,
    });

    const { data: teamsData, isLoading: loadingTeams } = useQuery({
        queryKey: ["org-teams", orgId],
        queryFn: async () => {
            const res = await fetch(`/api/organizations/teams?orgId=${orgId}`);
            if (!res.ok) throw new Error("Failed to fetch teams");
            const data = await res.json();
            return data.teams as Team[];
        },
        enabled: !!orgId,
    });

    const isAdmin = orgData?.role === "ADMIN";

    // --- Mutations ---

    const updateOrgMutation = useMutation({
        mutationFn: async (data: { name: string }) => {
            const res = await fetch(`/api/organizations/${orgId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to update workspace");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["organization", orgId] });
            queryClient.invalidateQueries({ queryKey: ["workspaces"] });
            toast.success("Workspace updated successfully");
        }
    });

    const updateMemberMutation = useMutation({
        mutationFn: async (vars: { userId: string, data: any }) => {
            const res = await fetch(`/api/organizations/members/${vars.userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...vars.data, orgId }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Update failed");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
            queryClient.invalidateQueries({ queryKey: ["org-teams", orgId] });
            toast.success("Member updated successfully");
            setEditingMember(null);
        },
        onError: (err) => toast.error(err.message),
    });

    const createTeamMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch("/api/organizations/teams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, orgId }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to create team");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["org-teams", orgId] });
            toast.success("Team created successfully");
            setCreateTeamOpen(false);
            setNewTeamName("");
            setNewTeamDescription("");
        },
        onError: (err) => toast.error(err.message),
    });

    const deleteTeamMutation = useMutation({
        mutationFn: async (teamId: string) => {
            const res = await fetch(`/api/organizations/teams/${teamId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete team");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["org-teams", orgId] });
            toast.success("Team deleted");
        }
    });

    // --- Handlers ---

    const handleSaveWorkspace = () => {
        if (!workspaceName.trim()) return;
        updateOrgMutation.mutate({ name: workspaceName });
    };

    const handleEditMember = (member: Member) => {
        setEditingMember(member);
        setSelectedTeams(member.teams.map(t => t.id));
        setSelectedRole(member.role);
        setSelectedStatus(member.status);
    };

    const handleSaveMember = () => {
        if (!editingMember) return;
        updateMemberMutation.mutate({
            userId: editingMember.userId,
            data: {
                role: selectedRole,
                status: selectedStatus,
                teamIds: selectedTeams,
            }
        });
    };

    const handleApprove = (userId: string) => {
        updateMemberMutation.mutate({
            userId,
            data: { status: "ACTIVE" } // Or PENDING_TEAM_ASSIGNMENT if you prefer
        });
    };

    const handleReject = (userId: string) => {
        updateMemberMutation.mutate({
            userId,
            data: { status: "DEACTIVATED" }
        });
    };

    const handleCreateTeam = (e: React.FormEvent) => {
        e.preventDefault();
        createTeamMutation.mutate({
            name: newTeamName,
            description: newTeamDescription
        });
    };

    const copyInviteLink = () => {
        if (!orgData?.inviteCode) return;
        const link = `${window.location.origin}/onboarding?code=${orgData.inviteCode}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        toast.success("Invite link copied!");
        setTimeout(() => setCopied(false), 2000);
    };

    if (loadingOrg || loadingMembers || loadingTeams) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#7b7c7e]" />
            </div>
        );
    }

    const pendingApprovals = members?.filter(m => m.status === "PENDING_APPROVAL") || [];
    const activeMembers = members?.filter(m => m.status !== "PENDING_APPROVAL") || [];

    return (
        <div className="max-w-4xl mx-auto py-10 px-6">
            <div className="mb-8 flex flex-col gap-2">
                <Link
                    href={`/org/${orgId}/projects`}
                    className="flex items-center gap-2 text-sm text-[#7b7c7e] hover:text-[#1a1b1e] font-medium transition-colors mb-2 w-fit"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to workspace
                </Link>
                <h1 className="text-3xl font-bold text-[#1a1b1e] tracking-tight flex items-center gap-3">
                    <SettingsIcon className="h-7 w-7 text-[#7b7c7e]" />
                    Workspace Settings
                </h1>
                <p className="text-[#7b7c7e]">Manage your workspace configuration, teams, and members.</p>
            </div>

            <Tabs defaultValue={initialTab} className="space-y-6">
                <TabsList className="bg-[#f1f1ef] p-1 rounded-lg w-fit">
                    <TabsTrigger value="general" className="rounded-md px-4 py-1.5 text-sm font-medium">General</TabsTrigger>
                    <TabsTrigger value="members" className="rounded-md px-4 py-1.5 text-sm font-medium flex items-center gap-2">
                        Members {pendingApprovals.length > 0 && <span className="h-2 w-2 bg-[#eb5757] rounded-full" />}
                    </TabsTrigger>
                    <TabsTrigger value="teams" className="rounded-md px-4 py-1.5 text-sm font-medium">Teams</TabsTrigger>
                </TabsList>

                {/* --- General Settings --- */}
                <TabsContent value="general" className="space-y-6 animate-in fade-in duration-300">
                    <Card className="border-[#e9e9e9] shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Workspace Branding</CardTitle>
                            <CardDescription>Update how this workspace appears to others.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="wsName" className="font-semibold text-sm">Workspace Name</Label>
                                <div className="flex gap-3">
                                    <Input
                                        id="wsName"
                                        value={workspaceName}
                                        onChange={(e) => setWorkspaceName(e.target.value)}
                                        className="max-w-md h-10"
                                        disabled={!isAdmin}
                                    />
                                    {isAdmin && (
                                        <Button
                                            onClick={handleSaveWorkspace}
                                            disabled={updateOrgMutation.isPending || workspaceName === orgData?.name}
                                            className="bg-[#1a1b1e] text-white hover:bg-[#37352f]"
                                        >
                                            {updateOrgMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-[#e9e9e9] shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Invite Members</CardTitle>
                            <CardDescription>Share this link with people you want to join this workspace.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 px-3 h-10 bg-[#f7f7f5] border border-[#e9e9e9] rounded-lg text-sm flex items-center text-[#7b7c7e] truncate select-all">
                                    {`${typeof window !== 'undefined' ? window.location.origin : ''}/onboarding?code=${orgData?.inviteCode}`}
                                </div>
                                <Button variant="outline" onClick={copyInviteLink} className="h-10 border-[#e9e9e9]">
                                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                    <span className="ml-2">{copied ? "Copied" : "Copy Link"}</span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- Members Management --- */}
                <TabsContent value="members" className="space-y-6 animate-in fade-in duration-300">
                    {pendingApprovals.length > 0 && (
                        <Card className="border-[#f1f1ef] bg-[#fbfbfa]">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2 text-[#b44d12]">
                                    <ShieldAlert className="h-5 w-5" />
                                    Pending Requests
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableBody>
                                        {pendingApprovals.map((member) => (
                                            <TableRow key={member.id} className="hover:bg-transparent">
                                                <TableCell className="pl-0">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9 border border-[#e9e9e9]">
                                                            <AvatarImage src={member.image || undefined} />
                                                            <AvatarFallback className="bg-[#f1f1ef] text-[#7b7c7e] text-xs font-bold">
                                                                {member.name?.[0] || member.email[0].toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div className="text-sm font-semibold">{member.name || "User"}</div>
                                                            <div className="text-[12px] text-[#7b7c7e]">{member.email}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-0">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            className="h-8 bg-[#1a1b1e] text-white hover:bg-[#37352f]"
                                                            onClick={() => handleApprove(member.userId)}
                                                            disabled={updateMemberMutation.isPending}
                                                        >
                                                            Approve
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 text-[#eb5757] hover:bg-red-50"
                                                            onClick={() => handleReject(member.userId)}
                                                            disabled={updateMemberMutation.isPending}
                                                        >
                                                            Decline
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    <Card className="border-[#e9e9e9] shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle className="text-lg">Members</CardTitle>
                                <CardDescription>Manage workspace members and their access levels.</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-[11px] font-bold uppercase tracking-wider text-[#7b7c7e] border-[#e9e9e9]">
                                {activeMembers.length} Total
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-b border-[#f1f1ef]">
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-[#7b7c7e] h-10">User</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-[#7b7c7e] h-10">Role</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-[#7b7c7e] h-10">Teams</TableHead>
                                        <TableHead className="text-right h-10"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {activeMembers.map((member) => (
                                        <TableRow key={member.id} className="border-b border-[#f1f1ef] group">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8 border border-[#e9e9e9]">
                                                        <AvatarImage src={member.image || undefined} />
                                                        <AvatarFallback className="text-[10px] font-bold bg-[#f1f1ef] text-[#7b7c7e]">
                                                            {member.name?.[0] || member.email?.[0]?.toUpperCase() || "?"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="text-sm font-medium text-[#1a1b1e]">{member.name || "User"}</div>
                                                        <div className="text-[11px] text-[#7b7c7e]">{member.email}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className={cn(
                                                    "text-[10px] h-5 font-bold uppercase tracking-wider",
                                                    member.role === "ADMIN" ? "bg-[#37352f] text-white" : "bg-[#f1f1ef] text-[#7b7c7e]"
                                                )}>
                                                    {member.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1 max-w-[150px]">
                                                    {member.teams.map(t => (
                                                        <Badge key={t.id} variant="outline" className="text-[10px] h-5 bg-white border-[#f1f1ef]">
                                                            {t.name}
                                                        </Badge>
                                                    ))}
                                                    {member.teams.length === 0 && <span className="text-[11px] text-[#7b7c7e] italic">No teams</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {isAdmin && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => handleEditMember(member)}
                                                    >
                                                        <Settings2 className="h-4 w-4 text-[#7b7c7e]" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- Teams Management --- */}
                <TabsContent value="teams" className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between mb-2">
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold">Workspace Teams</h3>
                            <p className="text-sm text-[#7b7c7e]">Group members into teams for project access and messaging.</p>
                        </div>
                        {isAdmin && (
                            <Button
                                onClick={() => setCreateTeamOpen(true)}
                                className="bg-[#1a1b1e] text-white hover:bg-[#37352f]"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Create Team
                            </Button>
                        )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        {teamsData?.map(team => (
                            <Card key={team.id} className="border-[#e9e9e9] shadow-sm hover:border-[#d1d1d1] transition-all group">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <CardTitle className="text-base font-bold">{team.name}</CardTitle>
                                            <CardDescription className="text-xs line-clamp-2">
                                                {team.description || "No description provided."}
                                            </CardDescription>
                                        </div>
                                        {isAdmin && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-[#eb5757] opacity-0 group-hover:opacity-100"
                                                onClick={() => deleteTeamMutation.mutate(team.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-2 text-[11px] font-bold text-[#7b7c7e] uppercase tracking-wider">
                                        <Users className="h-3.5 w-3.5" />
                                        {team.memberCount} Members
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {teamsData?.length === 0 && (
                            <div className="col-span-2 py-12 text-center border-2 border-dashed border-[#e9e9e9] rounded-xl">
                                <Users className="h-10 w-10 text-[#d1d2d5] mx-auto mb-4 opacity-30" />
                                <p className="text-[#7b7c7e] text-sm">No teams created yet. Start by creating your first team.</p>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* --- Dialogs --- */}

            {/* Edit Member Dialog */}
            <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Member</DialogTitle>
                        <DialogDescription>Change roles and team assignments for this user.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={editingMember?.image || undefined} />
                                <AvatarFallback>{editingMember?.name?.[0] || "?"}</AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="font-semibold text-sm">{editingMember?.name}</div>
                                <div className="text-xs text-[#7b7c7e]">{editingMember?.email}</div>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-[#7b7c7e]">Role</Label>
                                <Select value={selectedRole} onValueChange={(val: any) => setSelectedRole(val)}>
                                    <SelectTrigger className="h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MEMBER">Member</SelectItem>
                                        <SelectItem value="ADMIN">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-[#7b7c7e]">Status</Label>
                                <Select value={selectedStatus} onValueChange={(val: any) => setSelectedStatus(val)}>
                                    <SelectTrigger className="h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ACTIVE">Active</SelectItem>
                                        <SelectItem value="PENDING_TEAM_ASSIGNMENT">Pending Team Assignment</SelectItem>
                                        <SelectItem value="DEACTIVATED">Deactivated</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-[#7b7c7e]">Team Assignments</Label>
                                <div className="grid gap-2 rounded-lg border p-4 max-h-[160px] overflow-y-auto bg-[#fbfbfa]">
                                    {teamsData?.map((team) => (
                                        <div key={team.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`edit-team-${team.id}`}
                                                checked={selectedTeams.includes(team.id)}
                                                onCheckedChange={(checked) => {
                                                    if (checked === true) setSelectedTeams([...selectedTeams, team.id]);
                                                    else setSelectedTeams(selectedTeams.filter(id => id !== team.id));
                                                }}
                                            />
                                            <label htmlFor={`edit-team-${team.id}`} className="text-sm font-medium cursor-pointer">
                                                {team.name}
                                            </label>
                                        </div>
                                    ))}
                                    {teamsData?.length === 0 && <p className="text-xs text-[#7b7c7e] italic">No teams available.</p>}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditingMember(null)} className="h-10">Cancel</Button>
                        <Button onClick={handleSaveMember} disabled={updateMemberMutation.isPending} className="bg-[#1a1b1e] text-white hover:bg-[#37352f] h-10 px-6 font-semibold">
                            {updateMemberMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Team Dialog */}
            <Dialog open={createTeamOpen} onOpenChange={setCreateTeamOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create New Team</DialogTitle>
                        <DialogDescription>Define a new group for internal collaboration.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateTeam}>
                        <div className="grid gap-5 py-6">
                            <div className="space-y-2">
                                <Label htmlFor="teamName" className="text-xs font-bold uppercase tracking-wider text-[#7b7c7e]">Team Name</Label>
                                <Input
                                    id="teamName"
                                    placeholder="e.g. Frontend Engineering"
                                    value={newTeamName}
                                    onChange={(e) => setNewTeamName(e.target.value)}
                                    required
                                    className="h-11"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="teamDesc" className="text-xs font-bold uppercase tracking-wider text-[#7b7c7e]">Description (Optional)</Label>
                                <Textarea
                                    id="teamDesc"
                                    placeholder="Brief summary of the team's focus..."
                                    value={newTeamDescription}
                                    onChange={(e) => setNewTeamDescription(e.target.value)}
                                    className="min-h-[100px]"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setCreateTeamOpen(false)} className="h-10">Cancel</Button>
                            <Button type="submit" disabled={createTeamMutation.isPending || !newTeamName.trim()} className="bg-[#1a1b1e] text-white hover:bg-[#37352f] h-10 px-6 font-semibold">
                                {createTeamMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Team"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
