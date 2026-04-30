
"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityLogEntry, NodeAttachmentDTO, NodeCommentDTO, NodeDTO, NodePageDTO, ManualStatus } from "@/types";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Loader2,
    Calendar,
    Clock,
    CheckCircle2,
    PlayCircle,
    Sparkles,
    MessageSquarePlus,
    FileText,
    MessageSquare,
    Paperclip,
    Send,
    Trash2,
    History,
    Download
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

interface ProjectMemberOption {
    userId: string;
    userName: string | null;
    userEmail: string;
    userImage?: string | null;
}

interface NodePageResponse {
    page: NodePageDTO;
    activity: ActivityLogEntry[];
}

interface NodeCommentsResponse {
    comments: NodeCommentDTO[];
}

interface NodeAttachmentsResponse {
    attachments: NodeAttachmentDTO[];
}

export function NodeDetailSheet({
    node,
    open,
    onOpenChange,
    projectId,
}: NodeDetailSheetProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [pageContent, setPageContent] = useState("");
    const [commentBody, setCommentBody] = useState("");
    const [requestDialogOpen, setRequestDialogOpen] = useState(false);
    const [members, setMembers] = useState<SelectItem[]>([]);
    const queryClient = useQueryClient();
    const updateNodeMutation = useUpdateNode();

    const taskPageQuery = useQuery<NodePageResponse>({
        queryKey: ["node-page", node?.id],
        queryFn: async () => {
            const res = await fetch(`/api/nodes/${node!.id}/page`);
            if (!res.ok) throw new Error("Failed to fetch task page");
            return res.json();
        },
        enabled: open && !!node,
    });

    const commentsQuery = useQuery<NodeCommentsResponse>({
        queryKey: ["node-comments", node?.id],
        queryFn: async () => {
            const res = await fetch(`/api/nodes/${node!.id}/comments`);
            if (!res.ok) throw new Error("Failed to fetch comments");
            return res.json();
        },
        enabled: open && !!node,
    });

    const attachmentsQuery = useQuery<NodeAttachmentsResponse>({
        queryKey: ["node-attachments", node?.id],
        queryFn: async () => {
            const res = await fetch(`/api/nodes/${node!.id}/attachments`);
            if (!res.ok) throw new Error("Failed to fetch attachments");
            return res.json();
        },
        enabled: open && !!node,
    });

    const pageMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/nodes/${node!.id}/page`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contentMarkdown: pageContent }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to save page");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Task page saved");
            queryClient.invalidateQueries({ queryKey: ["node-page", node?.id] });
        },
        onError: (error: Error) => toast.error(error.message),
    });

    const commentMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/nodes/${node!.id}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: commentBody }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to add comment");
            }
            return res.json();
        },
        onSuccess: () => {
            setCommentBody("");
            queryClient.invalidateQueries({ queryKey: ["node-comments", node?.id] });
            queryClient.invalidateQueries({ queryKey: ["node-page", node?.id] });
            queryClient.invalidateQueries({ queryKey: ["graph", projectId] });
        },
        onError: (error: Error) => toast.error(error.message),
    });

    const attachmentMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch(`/api/nodes/${node!.id}/attachments`, {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to upload file");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("File uploaded");
            queryClient.invalidateQueries({ queryKey: ["node-attachments", node?.id] });
            queryClient.invalidateQueries({ queryKey: ["node-page", node?.id] });
            queryClient.invalidateQueries({ queryKey: ["graph", projectId] });
        },
        onError: (error: Error) => toast.error(error.message),
    });

    const deleteAttachmentMutation = useMutation({
        mutationFn: async (attachmentId: string) => {
            const res = await fetch(`/api/nodes/${node!.id}/attachments/${attachmentId}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to delete file");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["node-attachments", node?.id] });
            queryClient.invalidateQueries({ queryKey: ["node-page", node?.id] });
            queryClient.invalidateQueries({ queryKey: ["graph", projectId] });
        },
        onError: (error: Error) => toast.error(error.message),
    });

    // Sync local state when node changes
    useEffect(() => {
        if (node) {
            setTitle(node.title);
            setDescription(node.description || "");
        }
    }, [node]);

    useEffect(() => {
        if (taskPageQuery.data?.page) {
            setPageContent(taskPageQuery.data.page.contentMarkdown || "");
        }
    }, [taskPageQuery.data?.page]);

    // Fetch members
    useEffect(() => {
        if (open && projectId) {
            fetch(`/api/projects/${projectId}/members`)
                .then(res => res.json())
                .then(data => {
                    const membersArray = (data.members || []) as ProjectMemberOption[];
                    const formatted = membersArray.map((member) => ({
                        id: member.userId,
                        name: member.userName || member.userEmail,
                        image: member.userImage || undefined,
                        type: "user" as const
                    }));
                    setMembers(formatted);
                })
                .catch(err => console.error("Failed to fetch members", err));
        }
    }, [open, projectId]);

    if (!node) return null;

    const updateNode = async (updates: Partial<NodeDTO> & { ownerIds?: string[] }) => {
        return updateNodeMutation.mutateAsync({
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
        } catch {
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

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-[400px] sm:w-[680px] overflow-y-auto p-6 sm:p-8">
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

                    <Tabs defaultValue="details" className="py-6">
                        <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="details">Details</TabsTrigger>
                            <TabsTrigger value="page">
                                <FileText className="h-3.5 w-3.5 mr-1" />
                                Page
                            </TabsTrigger>
                            <TabsTrigger value="comments">
                                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                {node.commentCount || 0}
                            </TabsTrigger>
                            <TabsTrigger value="files">
                                <Paperclip className="h-3.5 w-3.5 mr-1" />
                                {node.attachmentCount || 0}
                            </TabsTrigger>
                            <TabsTrigger value="activity">
                                <History className="h-3.5 w-3.5 mr-1" />
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="details" className="pt-6 space-y-8">
                            <div className="space-y-3">
                                <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Summary</h4>
                                <Textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Add a short task summary..."
                                    className="min-h-[120px]"
                                />
                            </div>

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
                                                const currentIds = node.owners?.map((owner) => owner.id) || [];
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
                                    selectedIds={node.owners?.map((owner) => owner.id) || []}
                                    onSelect={(id) => {
                                        const currentIds = node.owners?.map((owner) => owner.id) || [];
                                        const newIds = [...currentIds, id];
                                        updateNode({ ownerIds: newIds });
                                    }}
                                    onRemove={(id) => {
                                        const currentIds = node.owners?.map((owner) => owner.id) || [];
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
                        </TabsContent>

                        <TabsContent value="page" className="pt-6 space-y-4">
                            <Textarea
                                value={pageContent}
                                onChange={(event) => setPageContent(event.target.value)}
                                placeholder="Write task notes, acceptance criteria, decisions, or handoff details..."
                                className="min-h-[280px] font-mono text-sm"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Markdown is supported. Mention project members with @name.</span>
                                <Button
                                    size="sm"
                                    onClick={() => pageMutation.mutate()}
                                    disabled={pageMutation.isPending}
                                >
                                    {pageMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                                    Save page
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="comments" className="pt-6 space-y-4">
                            <div className="space-y-3">
                                {(commentsQuery.data?.comments || []).map((comment) => (
                                    <div key={comment.id} className="rounded-md border p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-7 w-7">
                                                    <AvatarImage src={comment.authorImage || undefined} />
                                                    <AvatarFallback>{getInitials(comment.authorName || comment.authorEmail)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium">{comment.authorName || comment.authorEmail}</p>
                                                    <p className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p>
                                    </div>
                                ))}
                                {commentsQuery.data?.comments?.length === 0 && (
                                    <p className="text-sm text-muted-foreground">No comments yet.</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Textarea
                                    value={commentBody}
                                    onChange={(event) => setCommentBody(event.target.value)}
                                    placeholder="Add a comment..."
                                    className="min-h-[90px]"
                                />
                                <Button
                                    size="sm"
                                    onClick={() => commentMutation.mutate()}
                                    disabled={!commentBody.trim() || commentMutation.isPending}
                                >
                                    <Send className="h-3.5 w-3.5 mr-2" />
                                    Comment
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="files" className="pt-6 space-y-4">
                            <Input
                                type="file"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) attachmentMutation.mutate(file);
                                    event.currentTarget.value = "";
                                }}
                                disabled={attachmentMutation.isPending}
                            />
                            <div className="space-y-2">
                                {(attachmentsQuery.data?.attachments || []).map((attachment) => (
                                    <div key={attachment.id} className="flex items-center justify-between rounded-md border p-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">{attachment.fileName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {(attachment.sizeBytes / 1024).toFixed(1)} KB · {attachment.uploadedByName || "Unknown"} · {new Date(attachment.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {attachment.downloadUrl && (
                                                <Button asChild variant="ghost" size="icon" title="Download">
                                                    <a href={attachment.downloadUrl} target="_blank" rel="noreferrer">
                                                        <Download className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-600 hover:text-red-700"
                                                onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {attachmentsQuery.data?.attachments?.length === 0 && (
                                    <p className="text-sm text-muted-foreground">No files uploaded.</p>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="activity" className="pt-6 space-y-3">
                            {(taskPageQuery.data?.activity || []).map((entry) => (
                                <div key={entry.id} className="rounded-md border p-3">
                                    <p className="text-sm font-medium">{entry.action.replaceAll("_", " ")}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {entry.userName} · {new Date(entry.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            ))}
                            {taskPageQuery.data?.activity?.length === 0 && (
                                <p className="text-sm text-muted-foreground">No activity yet.</p>
                            )}
                        </TabsContent>
                    </Tabs>

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
