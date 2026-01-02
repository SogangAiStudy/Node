"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Copy, Check, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SharePopoverProps {
    projectId: string;
    orgId: string;
    children: React.ReactNode;
}

interface ProjectMember {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    role: string;
}

const PERMISSION_LEVELS = [
    { value: "ADMIN", label: "Full access" },
    { value: "EDITOR", label: "Can edit" },
    { value: "REQUESTER", label: "Can request" },
    { value: "VIEWER", label: "Can view" },
];

export function SharePopover({ projectId, orgId, children }: SharePopoverProps) {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("EDITOR");
    const [copied, setCopied] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data: members } = useQuery({
        queryKey: ["project-members", projectId],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/members`);
            if (!res.ok) throw new Error("Failed to fetch members");
            const data = await res.json();
            return data.members as ProjectMember[];
        },
        enabled: isOpen,
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
            toast.success("Invitation sent");
        },
        onError: (error: Error) => {
            toast.error(error.message);
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
        toast.success("Link copied");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[480px] p-0 shadow-2xl border-border bg-white" sideOffset={8}>
                <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-[#1a1b1e]">Share</h3>
                    </div>

                    <div className="space-y-4">
                        {/* Invite Section */}
                        <div className="flex gap-2">
                            <Input
                                placeholder="Email or group, separated by commas"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                                className="flex-1 h-9"
                            />
                            <Button
                                onClick={handleInvite}
                                disabled={!email || inviteMutation.isPending}
                                size="sm"
                                className="bg-[#1a1b1e] hover:bg-black text-white"
                            >
                                Invite
                            </Button>
                        </div>

                        {/* Current Members */}
                        {members && members.length > 0 && (
                            <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                                {members.map((member) => (
                                    <div
                                        key={member.id}
                                        className="flex items-center justify-between py-2 px-1 hover:bg-slate-50 rounded-lg transition-colors"
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <Avatar className="h-8 w-8 shrink-0">
                                                <AvatarFallback className="text-[10px] bg-slate-100 font-bold">
                                                    {member.userName?.[0]?.toUpperCase() || "?"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="text-sm font-medium truncate">{member.userName}</span>
                                                <span className="text-xs text-muted-foreground truncate">
                                                    {member.userEmail}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap ml-2">
                                            {PERMISSION_LEVELS.find(p => p.value === member.role)?.label || member.role}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* General Access */}
                        <div className="pt-2">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold text-[#1a1b1e]">General access</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                        <Users className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[13px] font-medium leading-tight">Link settings</span>
                                        <span className="text-[11px] text-muted-foreground">Control who can use the link</span>
                                    </div>
                                </div>
                                <Select defaultValue="restricted">
                                    <SelectTrigger className="w-[140px] h-8 text-[12px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="restricted">Only people invited</SelectItem>
                                        <SelectItem value="org">Anyone in organization</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Footer / Copy Link */}
                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 px-2 font-semibold"
                                onClick={copyLink}
                            >
                                {copied ? (
                                    <Check className="h-4 w-4 mr-1" />
                                ) : (
                                    <Copy className="h-4 w-4 mr-1" />
                                )}
                                Copy link
                            </Button>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
