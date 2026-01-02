"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, X, Users } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface ProjectMember {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    role: string;
}

const PERMISSION_LEVELS = [
    { value: "ADMIN", label: "Full access", description: "Edit, suggest, comment, and share" },
    { value: "EDITOR", label: "Can edit", description: "Edit, suggest, and comment" },
    { value: "REQUESTER", label: "Can request", description: "Suggest and comment" },
    { value: "VIEWER", label: "Can view", description: "View only" },
];

export default function MembersPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.projectId as string;
    const orgId = params.orgId as string;
    const queryClient = useQueryClient();

    const [email, setEmail] = useState("");
    const [role, setRole] = useState("EDITOR");

    const { data: members, isLoading } = useQuery({
        queryKey: ["project-members", projectId],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/members`);
            if (!res.ok) throw new Error("Failed to fetch members");
            const data = await res.json();
            return data.members as ProjectMember[];
        },
    });

    const inviteMutation = useMutation({
        mutationFn: async ({ email, role }: { email: string; role: string }) => {
            const res = await fetch(`/api/projects/${projectId}/invite`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, role }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to invite user");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
            setEmail("");
            toast.success("User invited successfully");
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });

    const updateRoleMutation = useMutation({
        mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
            const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role }),
            });
            if (!res.ok) throw new Error("Failed to update role");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
            toast.success("Role updated");
        },
        onError: () => {
            toast.error("Failed to update role");
        },
    });

    const removeMemberMutation = useMutation({
        mutationFn: async (userId: string) => {
            const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to remove member");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
            toast.success("Member removed");
        },
        onError: () => {
            toast.error("Failed to remove member");
        },
    });

    const handleInvite = () => {
        if (!email) return;
        inviteMutation.mutate({ email, role });
    };

    return (
        <div className="container max-w-4xl mx-auto py-8">
            {/* Header */}
            <div className="mb-8">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.back()}
                    className="mb-4"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <h1 className="text-3xl font-bold">Member Management</h1>
                <p className="text-muted-foreground mt-2">
                    Manage who has access to this project
                </p>
            </div>

            {/* Invite Section */}
            <div className="mb-8 p-6 border rounded-lg bg-card">
                <h2 className="text-lg font-semibold mb-4">Invite Members</h2>
                <div className="flex gap-3">
                    <Input
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                        className="flex-1"
                    />
                    <Select value={role} onValueChange={setRole}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PERMISSION_LEVELS.map((level) => (
                                <SelectItem key={level.value} value={level.value}>
                                    {level.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        onClick={handleInvite}
                        disabled={!email || inviteMutation.isPending}
                    >
                        Invite
                    </Button>
                </div>
            </div>

            {/* Members List */}
            <div className="border rounded-lg bg-card">
                <div className="p-6 border-b">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        <h2 className="text-lg font-semibold">
                            Members ({members?.length || 0})
                        </h2>
                    </div>
                </div>
                <div className="divide-y">
                    {isLoading ? (
                        <div className="p-8 text-center text-muted-foreground">
                            Loading members...
                        </div>
                    ) : members && members.length > 0 ? (
                        members.map((member) => (
                            <div
                                key={member.id}
                                className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback className="bg-primary/10">
                                            {member.userName?.[0]?.toUpperCase() || "?"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="font-medium">{member.userName}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {member.userEmail}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Select
                                        value={member.role}
                                        onValueChange={(newRole) =>
                                            updateRoleMutation.mutate({
                                                userId: member.userId,
                                                role: newRole,
                                            })
                                        }
                                    >
                                        <SelectTrigger className="w-[160px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PERMISSION_LEVELS.map((level) => (
                                                <SelectItem
                                                    key={level.value}
                                                    value={level.value}
                                                >
                                                    <div>
                                                        <div className="font-medium">
                                                            {level.label}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {level.description}
                                                        </div>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeMemberMutation.mutate(member.userId)}
                                        className="hover:bg-destructive/10 hover:text-destructive"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-muted-foreground">
                            No members yet. Invite someone to get started!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
