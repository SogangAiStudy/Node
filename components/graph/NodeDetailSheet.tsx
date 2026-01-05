
"use client";

import { useState, useEffect } from "react";
import { NodeDTO, ManualStatus } from "@/types";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Loader2,
    Calendar,
    Clock,
    CheckCircle2,
    PlayCircle,
    User,
    Sparkles,
    MessageSquarePlus
} from "lucide-react";
import { toast } from "sonner";
import { CreateRequestDialog } from "./CreateRequestDialog";
import { MultiSelectSearch, SelectItem } from "@/components/ui/multi-select-search";
import { cn } from "@/lib/utils";
import { useUpdateNode } from "@/hooks/use-node-mutations";

interface NodeDetailSheetProps {
    node: NodeDTO | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    orgId: string;
    onDataChange: () => void;
}

export function NodeDetailSheet({
    node,
    open,
    onOpenChange,
    projectId,
    orgId,
    onDataChange,
}: NodeDetailSheetProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [requestDialogOpen, setRequestDialogOpen] = useState(false);
    const [members, setMembers] = useState<SelectItem[]>([]);
    const updateNodeMutation = useUpdateNode();

    // Sync local state when node changes
    useEffect(() => {
        if (node) {
            setTitle(node.title);
            setDescription(node.description || "");
        }
    }, [node]);

    // Fetch members
    useEffect(() => {
        if (open && projectId) {
            fetch(`/api/projects/${projectId}/members`)
                .then(res => res.json())
                .then(data => {
                    const membersArray = data.members || [];
                    const formatted = membersArray.map((m: any) => ({
                        id: m.userId,
                        name: m.userName || m.userEmail,
                        image: m.userImage,
                        type: "user" as const
                    }));
                    setMembers(formatted);
                })
                .catch(err => console.error("Failed to fetch members", err));
        }
    }, [open, projectId]);

    if (!node) return null;

    const updateNode = async (updates: Partial<NodeDTO> & { ownerIds?: string[] }) => {
        updateNodeMutation.mutate({
            nodeId: node.id,
            projectId,
            updates
        });
    };

    const handleSaveDetails = async () => {
        setIsSaving(true);
        try {
            await updateNode({ title, description });
            toast.success("Saved successfully");
        } catch (error) {
            toast.error("Failed to save");
        } finally {
            setIsSaving(false);
        }
    };

    const currentStatus = node.manualStatus;

    const handleStatusChange = async (newStatus: ManualStatus) => {
        if (newStatus === currentStatus) return;
        updateNode({ manualStatus: newStatus });
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const primaryOwner = node.owners?.[0];

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto p-6 sm:p-8">
                    <SheetHeader className="space-y-4 mb-6">
                        <div className="flex items-start justify-between pr-8">
                            <div className="space-y-1 flex-1 mr-4">
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="font-bold text-lg"
                                    placeholder="Task Title"
                                />
                            </div>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleSaveDetails}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save"
                                )}
                            </Button>
                        </div>

                        {/* Status Toggles */}
                        <div className="flex p-1 bg-slate-100 rounded-lg w-fit">
                            {(["TODO", "DOING", "DONE"] as ManualStatus[]).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => handleStatusChange(status)}
                                    className={cn(
                                        "px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2",
                                        currentStatus === status
                                            ? "bg-white text-slate-900 shadow-sm"
                                            : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                                    )}
                                >
                                    {status === "TODO" && <Clock className="w-3.5 h-3.5" />}
                                    {status === "DOING" && <PlayCircle className="w-3.5 h-3.5" />}
                                    {status === "DONE" && <CheckCircle2 className="w-3.5 h-3.5" />}
                                    {status}
                                </button>
                            ))}
                        </div>
                    </SheetHeader>

                    <div className="py-6 space-y-8">
                        {/* Description */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Description</h4>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Add a more detailed description..."
                                className="min-h-[120px]"
                            />
                        </div>

                        {/* Metadata Grid */}
                        <div className="grid grid-cols-1 gap-6">
                            {/* Node Owner */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Node Owner</h4>
                                <div className="relative">
                                    <select
                                        value={node.owners && node.owners.length > 0 ? node.owners[0].id : ""}
                                        onChange={(e) => {
                                            const selectedId = e.target.value;
                                            if (selectedId) {
                                                // Keep all existing owners but update the first one as primary
                                                const currentIds = node.owners?.map((o: any) => o.id) || [];
                                                const otherIds = currentIds.filter(id => id !== selectedId);
                                                updateNode({ ownerIds: [selectedId, ...otherIds] });
                                            }
                                        }}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    >
                                        <option value="">Select owner...</option>
                                        {members.map((member) => (
                                            <option key={member.id} value={member.id}>
                                                {member.name}
                                            </option>
                                        ))}
                                    </select>
                                    {node.owners && node.owners.length > 0 && (
                                        <div className="mt-2 flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback className="text-xs">
                                                    {getInitials(node.owners[0].name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-medium text-slate-900">{node.owners[0].name}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Engaging Team */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Engaging Team</h4>
                                <MultiSelectSearch
                                    items={members}
                                    selectedIds={node.owners?.map((o: any) => o.id) || []}
                                    onSelect={(id) => {
                                        const currentIds = node.owners?.map((o: any) => o.id) || [];
                                        const newIds = [...currentIds, id];
                                        updateNode({ ownerIds: newIds });
                                    }}
                                    onRemove={(id) => {
                                        const currentIds = node.owners?.map((o: any) => o.id) || [];
                                        const newIds = currentIds.filter(cid => cid !== id);
                                        updateNode({ ownerIds: newIds });
                                    }}
                                    placeholder="Add team members..."
                                    searchPlaceholder="Search members..."
                                />
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Due Date</h4>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                        <Calendar className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <Input
                                        type="date"
                                        className="pl-10"
                                        value={node.dueAt ? new Date(node.dueAt).toISOString().split('T')[0] : ""}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            updateNode({ dueAt: val ? new Date(val).toISOString() : null });
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Computed Status (ReadOnly) */}
                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-500 uppercase">System Status</h4>
                                <Badge variant="outline" className={cn(
                                    "text-xs",
                                    node.computedStatus === "BLOCKED" && "bg-red-50 text-red-600 border-red-200",
                                    node.computedStatus === "WAITING" && "bg-yellow-50 text-yellow-600 border-yellow-200",
                                    node.computedStatus === "DOING" && "bg-blue-50 text-blue-600 border-blue-200"
                                )}>
                                    {node.computedStatus}
                                </Badge>
                            </div>
                            <p className="text-xs text-slate-500">
                                {node.computedStatus === "BLOCKED" && "This task cannot proceed because it depends on incomplete upstream tasks."}
                                {node.computedStatus === "WAITING" && "This task is waiting for external dependencies or approvals."}
                                {node.computedStatus === "DOING" && "All dependencies are met. This task is ready to be worked on."}
                                {node.computedStatus === "TODO" && "Ready to start."}
                                {node.computedStatus === "DONE" && "Completed."}
                            </p>
                            {node.computedStatus === "BLOCKED" && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                    onClick={() => setRequestDialogOpen(true)}
                                >
                                    <Sparkles className="w-3 h-3 mr-2" />
                                    Ask AI to Resolve Blockers
                                </Button>
                            )}
                        </div>
                    </div>

                    <SheetFooter className="flex-col sm:justify-start gap-2 pt-4 border-t">
                        <Button
                            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={() => setRequestDialogOpen(true)}
                        >
                            <MessageSquarePlus className="w-4 h-4 mr-2" />
                            New Request / Question
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <CreateRequestDialog
                projectId={projectId}
                linkedNodeId={node.id}
                open={requestDialogOpen}
                onOpenChange={setRequestDialogOpen}
                onSuccess={() => {
                    setRequestDialogOpen(false);
                    toast.success("Request Sent!");
                }}
            />
        </>
    );
}
