"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { toast } from "sonner";
import { Loader2, Settings2, Users, Plus, Check, X, ShieldAlert, Copy, CheckCircle2 } from "lucide-react";

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
}

export default function MembersPage() {
    const queryClient = useQueryClient();

    // UI State
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [createTeamOpen, setCreateTeamOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    // Member Edit State
    const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
    const [selectedRole, setSelectedRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
    const [selectedStatus, setSelectedStatus] = useState<string>("");

    // Team Creation State
    const [newTeamName, setNewTeamName] = useState("");
    const [newTeamDescription, setNewTeamDescription] = useState("");

    const { data: members, isLoading: loadingMembers } = useQuery({
        queryKey: ["org-members"],
        queryFn: async () => {
            const res = await fetch("/api/organizations/members");
            if (!res.ok) throw new Error("Failed to fetch members");
            const data = await res.json();
            return data.members as Member[];
        },
    });

    const { data: teams, isLoading: loadingTeams } = useQuery({
        queryKey: ["org-teams"],
        queryFn: async () => {
            const res = await fetch("/api/organizations/teams");
            if (!res.ok) throw new Error("Failed to fetch teams");
            const data = await res.json();
            return data.teams as Team[];
        },
    });

    const { data: organizations } = useQuery({
        queryKey: ["organizations"],
        queryFn: async () => {
            const res = await fetch("/api/organizations");
            if (!res.ok) throw new Error("Failed to fetch organizations");
            const data = await res.json();
            return data.organizations as Organization[];
        },
    });

    const currentOrg = organizations?.[0]; // Assuming user belongs to one for now

    const updateMemberMutation = useMutation({
        mutationFn: async (vars: { userId: string, data: any }) => {
            const res = await fetch(`/api/organizations/members/${vars.userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(vars.data),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Update failed");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["org-members"] });
            queryClient.invalidateQueries({ queryKey: ["org-teams"] });
            toast.success("Member updated successfully");
            setEditingMember(null);
        },
        onError: (err) => {
            toast.error(err.message);
        },
    });

    const createTeamMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch("/api/organizations/teams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to create team");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["org-teams"] });
            toast.success("Team created successfully");
            setCreateTeamOpen(false);
            setNewTeamName("");
            setNewTeamDescription("");
        },
        onError: (err) => {
            toast.error(err.message);
        },
    });

    const handleEdit = (member: Member) => {
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
            data: { status: "PENDING_TEAM_ASSIGNMENT" }
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
        if (!currentOrg?.inviteCode) return;
        const link = `${window.location.origin}/onboarding?code=${currentOrg.inviteCode}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        toast.success("Invite link copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

    if (loadingMembers || loadingTeams) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const pendingApprovals = members?.filter(m => m.status === "PENDING_APPROVAL") || [];
    const activeMembers = members?.filter(m => m.status !== "PENDING_APPROVAL") || [];

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Teams & Members</h1>
                    <p className="text-muted-foreground">Manage organization users and team assignments</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        className="text-muted-foreground hover:bg-slate-100 border-dashed border"
                        onClick={async () => {
                            const res = await fetch("/api/test/make-user", { method: "POST" });
                            if (res.ok) {
                                queryClient.invalidateQueries({ queryKey: ["org-members"] });
                                toast.success("Mock user created and added to organization");
                            } else {
                                toast.error("Failed to create mock user");
                            }
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Make User
                    </Button>
                    <Button variant="outline" onClick={copyInviteLink} disabled={!currentOrg?.inviteCode}>
                        {copied ? <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                        {copied ? "Copied!" : "Copy Invite Link"}
                    </Button>
                    <Button onClick={() => setCreateTeamOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Create Team
                    </Button>
                </div>
            </div>

            <div className="grid gap-8">
                {pendingApprovals.length > 0 && (
                    <Card className="border-amber-200 bg-amber-50/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-amber-800 font-bold">
                                <ShieldAlert className="h-5 w-5" />
                                Pending Approvals
                            </CardTitle>
                            <CardDescription className="text-amber-700/70">
                                These users have requested to join your organization.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableBody>
                                    {pendingApprovals.map((member) => (
                                        <TableRow key={member.id} className="border-amber-100/50 hover:bg-amber-100/30">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={member.image || undefined} />
                                                        <AvatarFallback>{member.name?.[0] || member.email[0].toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium">{member.name}</div>
                                                        <div className="text-xs text-muted-foreground">{member.email}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200"
                                                    disabled={updateMemberMutation.isPending}
                                                    onClick={() => handleApprove(member.userId)}
                                                >
                                                    <Check className="mr-1 h-3 w-3" /> Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border-red-200"
                                                    disabled={updateMemberMutation.isPending}
                                                    onClick={() => handleReject(member.userId)}
                                                >
                                                    <X className="mr-1 h-3 w-3" /> Reject
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Active Members
                        </CardTitle>
                        <CardDescription>
                            Users currently in your organization and their assigned roles/teams.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Teams</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activeMembers.map((member) => (
                                    <TableRow key={member.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={member.image || undefined} />
                                                    <AvatarFallback>{member.name?.[0] || member.email[0].toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <div className="font-medium">{member.name}</div>
                                                    <div className="text-xs text-muted-foreground">{member.email}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={member.role === "ADMIN" ? "default" : "outline"}>
                                                {member.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                member.status === "ACTIVE" ? "success" :
                                                    member.status === "PENDING_TEAM_ASSIGNMENT" ? "secondary" : "destructive"
                                            } className={
                                                member.status === "ACTIVE" ? "bg-green-50 text-green-700 hover:bg-green-100" :
                                                    member.status === "PENDING_TEAM_ASSIGNMENT" ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : ""
                                            }>
                                                {member.status.replace(/_/g, " ")}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {member.teams.length > 0 ? (
                                                    member.teams.map(t => (
                                                        <Badge key={t.id} variant="secondary" className="font-normal text-[10px] h-5">
                                                            {t.name}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">No teams</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => handleEdit(member)}>
                                                <Settings2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {teams?.map(team => (
                        <Card key={team.id}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg">{team.name}</CardTitle>
                                <CardDescription className="line-clamp-2 min-h-[2.5rem]">{team.description || "No description provided."}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Edit Member Dialog */}
            <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Member</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        <div className="flex items-center gap-4 border-b pb-4">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={editingMember?.image || undefined} />
                                <AvatarFallback>{editingMember?.name?.[0] || "?"}</AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="font-medium">{editingMember?.name}</div>
                                <div className="text-sm text-muted-foreground">{editingMember?.email}</div>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Organization Role</Label>
                            <Select value={selectedRole} onValueChange={(val: any) => setSelectedRole(val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MEMBER">Member (Requires teams)</SelectItem>
                                    <SelectItem value="ADMIN">Admin (Bypass all)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>Account Status</Label>
                            <Select value={selectedStatus} onValueChange={(val: any) => setSelectedStatus(val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="PENDING_TEAM_ASSIGNMENT">Pending Team Assignment</SelectItem>
                                    <SelectItem value="DEACTIVATED">Deactivated</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label className="mb-2">Team Assignments</Label>
                            <div className="grid gap-3 rounded-md border p-3 max-h-40 overflow-y-auto">
                                {teams?.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic">No teams created yet.</p>
                                ) : teams?.map((team) => (
                                    <div key={team.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`edit-team-${team.id}`}
                                            checked={selectedTeams.includes(team.id)}
                                            onCheckedChange={(checked: boolean | "indeterminate") => {
                                                if (checked === true) {
                                                    setSelectedTeams([...selectedTeams, team.id]);
                                                } else if (checked === false) {
                                                    setSelectedTeams(selectedTeams.filter(id => id !== team.id));
                                                }
                                            }}
                                        />
                                        <label
                                            htmlFor={`edit-team-${team.id}`}
                                            className="text-sm font-medium leading-none cursor-pointer"
                                        >
                                            {team.name}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingMember(null)}>Cancel</Button>
                        <Button onClick={handleSaveMember} disabled={updateMemberMutation.isPending}>
                            {updateMemberMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                                </>
                            ) : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Team Dialog */}
            <Dialog open={createTeamOpen} onOpenChange={setCreateTeamOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create New Team</DialogTitle>
                        <DialogDescription>
                            Create a group for users to collaborate on projects.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateTeam}>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="teamName">Team Name</Label>
                                <Input
                                    id="teamName"
                                    placeholder="e.g. Design Team"
                                    value={newTeamName}
                                    onChange={(e) => setNewTeamName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="teamDesc">Description (Optional)</Label>
                                <Textarea
                                    id="teamDesc"
                                    placeholder="What this team focuses on..."
                                    value={newTeamDescription}
                                    onChange={(e) => setNewTeamDescription(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setCreateTeamOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={createTeamMutation.isPending || !newTeamName.trim()}>
                                {createTeamMutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                                    </>
                                ) : "Create Team"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
