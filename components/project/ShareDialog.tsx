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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface ShareDialogProps {
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
    role: string;
}

const PERMISSION_LEVELS = [
    { value: "ADMIN", label: "Full access" },
    { value: "EDITOR", label: "Can edit" },
    { value: "REQUESTER", label: "Can request" },
    { value: "VIEWER", label: "Can view" },
];

export function ShareDialog({ open, onOpenChange, projectId, orgId }: ShareDialogProps) {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("EDITOR");
    const [copied, setCopied] = useState(false);
    const queryClient = useQueryClient();

    const { data: members } = useQuery({
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Share</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Invite Section */}
                    <div className="flex gap-2">
                        <Input
                            placeholder="Email or group, separated by commas"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                            className="flex-1"
                        />
                        <Button
                            onClick={handleInvite}
                            disabled={!email || inviteMutation.isPending}
                        >
                            Invite
                        </Button>
                    </div>

                    {/* Current Members */}
                    {members && members.length > 0 && (
                        <div className="space-y-2">
                            {members.slice(0, 3).map((member) => (
                                <div
                                    key={member.id}
                                    className="flex items-center justify-between py-1"
                                >
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                            <AvatarFallback className="text-[9px] bg-muted">
                                                {member.userName?.[0]?.toUpperCase() || "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{member.userName}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {member.userEmail}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                        {PERMISSION_LEVELS.find(p => p.value === member.role)?.label || member.role}
                                    </span>
                                </div>
                            ))}
                            {members.length > 3 && (
                                <p className="text-xs text-muted-foreground pt-1">
                                    +{members.length - 3} more members
                                </p>
                            )}
                        </div>
                    )}

                    {/* General Access */}
                    <div className="pt-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">General access</span>
                            <Select defaultValue="restricted">
                                <SelectTrigger className="w-[160px] h-8">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="restricted">Only people invited</SelectItem>
                                    <SelectItem value="org">Anyone in organization</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Copy Link */}
                    <div className="pt-2 border-t">
                        <Button
                            variant="ghost"
                            className="w-full justify-between"
                            onClick={copyLink}
                        >
                            <span className="text-sm">Copy link</span>
                            {copied ? (
                                <Check className="h-4 w-4 text-green-600" />
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
