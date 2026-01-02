"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Copy, Check, X, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ShareModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    orgId: string;
}

interface ProjectMember {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    userImage?: string;
    role: string;
}

const PERMISSION_LEVELS = [
    { value: "ADMIN", label: "Full access", description: "Edit, suggest, comment, and share" },
    { value: "EDITOR", label: "Can edit", description: "Edit, suggest, and comment" },
    { value: "REQUESTER", label: "Can request", description: "Suggest and comment" },
    { value: "VIEWER", label: "Can view", description: "View only" },
];

export function ShareModal({ open, onOpenChange, projectId, orgId }: ShareModalProps) {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("VIEWER");
    const [copied, setCopied] = useState(false);
    const queryClient = useQueryClient();

    const { data: members, isLoading } = useQuery({
        queryKey: ["project-members", projectId],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/members`);
            if (!res.ok) throw new Error("Failed to fetch members");
            const data = await res.json();
            return data.members as ProjectMember[];
        },
        enabled: open,
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

    const copyLink = () => {
        const link = `${window.location.origin}/org/${orgId}/projects/${projectId}/graph`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        toast.success("Link copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-[#1a1b1e] border-[#2c2d31] text-[#d1d2d5]">
                <DialogHeader>
                    <DialogTitle className="text-white">Share project</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Invite Section */}
                    <div className="flex gap-2">
                        <Input
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                            className="flex-1 bg-[#0f1011] border-[#2c2d31] text-[#d1d2d5] placeholder:text-[#7b7c7e]"
                        />
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger className="w-[140px] bg-[#0f1011] border-[#2c2d31] text-[#d1d2d5]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1b1e] border-[#2c2d31]">
                                {PERMISSION_LEVELS.map((level) => (
                                    <SelectItem
                                        key={level.value}
                                        value={level.value}
                                        className="text-[#d1d2d5] focus:bg-[#2c2d31] focus:text-white"
                                    >
                                        {level.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            onClick={handleInvite}
                            disabled={!email || inviteMutation.isPending}
                            className="bg-[#2c2d31] hover:bg-[#37373d] text-white"
                        >
                            Invite
                        </Button>
                    </div>

                    {/* Members List */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-[#7b7c7e] font-semibold uppercase tracking-wider">
                            <Users className="h-3.5 w-3.5" />
                            People with access
                        </div>
                        <div className="space-y-1 max-h-[300px] overflow-y-auto">
                            {isLoading ? (
                                <div className="text-center py-4 text-[#7b7c7e]">Loading...</div>
                            ) : members && members.length > 0 ? (
                                members.map((member) => (
                                    <div
                                        key={member.id}
                                        className="flex items-center justify-between p-2 rounded-lg hover:bg-[#2c2d31] group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={member.userImage} />
                                                <AvatarFallback className="bg-[#2c2d31] text-[#d1d2d5] text-xs">
                                                    {member.userName?.[0]?.toUpperCase() || "?"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="text-sm font-medium">{member.userName}</div>
                                                <div className="text-xs text-[#7b7c7e]">{member.userEmail}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Select
                                                value={member.role}
                                                onValueChange={(newRole) =>
                                                    updateRoleMutation.mutate({ userId: member.userId, role: newRole })
                                                }
                                            >
                                                <SelectTrigger className="w-[130px] h-8 bg-transparent border-transparent hover:bg-[#37373d] text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-[#1a1b1e] border-[#2c2d31]">
                                                    {PERMISSION_LEVELS.map((level) => (
                                                        <SelectItem
                                                            key={level.value}
                                                            value={level.value}
                                                            className="text-[#d1d2d5] focus:bg-[#2c2d31] focus:text-white"
                                                        >
                                                            <div>
                                                                <div className="font-medium">{level.label}</div>
                                                                <div className="text-xs text-[#7b7c7e]">{level.description}</div>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:bg-[#37373d] hover:text-red-400"
                                                onClick={() => removeMemberMutation.mutate(member.userId)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-4 text-[#7b7c7e]">No members yet</div>
                            )}
                        </div>
                    </div>

                    {/* Copy Link */}
                    <div className="pt-2 border-t border-[#2c2d31]">
                        <Button
                            variant="outline"
                            className="w-full justify-between bg-[#0f1011] border-[#2c2d31] text-[#d1d2d5] hover:bg-[#2c2d31] hover:text-white"
                            onClick={copyLink}
                        >
                            <span className="text-sm">Copy link</span>
                            {copied ? (
                                <Check className="h-4 w-4 text-green-400" />
                            ) : (
                                <Copy className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
