"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    Loader2,
    Sparkles,
    Check,
    ArrowRight,
    Trash2,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    Users,
    X,
    Edit3,
    FileText,
    Lightbulb,
    MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TeamDTO } from "@/types";

interface GeneratedPlanNode {
    tempId: string;
    title: string;
    description: string;
    type: "TASK" | "DECISION" | "BLOCKER" | "INFOREQ";
    suggestedTeamIds: string[];
    phase?: string;
    selected?: boolean;
}

interface GeneratedPlanEdge {
    fromTempId: string;
    toTempId: string;
    relation: "DEPENDS_ON" | "APPROVAL_BY" | "NEEDS_INFO_FROM" | "HANDOFF_TO";
}

interface GeneratedPlan {
    inputType: "keyword" | "outline" | "meeting_notes";
    nodes: GeneratedPlanNode[];
    edges: GeneratedPlanEdge[];
    summary: string;
}

interface GenerateNodesDialogProps {
    projectId: string;
    orgId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

type Step = "input" | "plan" | "generating";

export function GenerateNodesDialog({
    projectId,
    orgId,
    open,
    onOpenChange,
    onSuccess,
}: GenerateNodesDialogProps) {
    const [text, setText] = useState("");
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [plan, setPlan] = useState<GeneratedPlan | null>(null);
    const [step, setStep] = useState<Step>("input");
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

    // Fetch project teams
    const { data: teamsData } = useQuery({
        queryKey: ["project-teams", projectId],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/teams`);
            if (!res.ok) throw new Error("Failed to fetch teams");
            const data = await res.json();
            return data.teams as TeamDTO[];
        },
        enabled: !!projectId && open,
    });

    const teams = teamsData || [];

    // Auto-expand all phases when plan is loaded
    useEffect(() => {
        if (plan?.nodes) {
            const phases = new Set(plan.nodes.map((n) => n.phase || "Tasks"));
            setExpandedPhases(phases);
        }
    }, [plan]);

    const handleGeneratePlan = async () => {
        if (!text.trim()) {
            toast.error("Please enter some text to analyze");
            return;
        }

        setIsGeneratingPlan(true);
        try {
            const res = await fetch("/api/ai/generate-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId, text }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to generate plan");
            }

            const data: GeneratedPlan = await res.json();
            // Add selected flag to all nodes
            data.nodes = data.nodes.map((n) => ({ ...n, selected: true }));
            setPlan(data);
            setStep("plan");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to generate plan");
        } finally {
            setIsGeneratingPlan(false);
        }
    };

    const handleRegeneratePlan = async () => {
        setIsGeneratingPlan(true);
        try {
            const res = await fetch("/api/ai/generate-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId,
                    text,
                    feedback: "Please regenerate with different approach",
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to regenerate plan");
            }

            const data: GeneratedPlan = await res.json();
            data.nodes = data.nodes.map((n) => ({ ...n, selected: true }));
            setPlan(data);
            toast.success("Plan regenerated");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to regenerate plan");
        } finally {
            setIsGeneratingPlan(false);
        }
    };

    const toggleNode = (tempId: string) => {
        if (!plan) return;
        setPlan({
            ...plan,
            nodes: plan.nodes.map((n) =>
                n.tempId === tempId ? { ...n, selected: !n.selected } : n
            ),
        });
    };

    const updateNode = (tempId: string, updates: Partial<GeneratedPlanNode>) => {
        if (!plan) return;
        setPlan({
            ...plan,
            nodes: plan.nodes.map((n) =>
                n.tempId === tempId ? { ...n, ...updates } : n
            ),
        });
    };

    const deleteNode = (tempId: string) => {
        if (!plan) return;
        setPlan({
            ...plan,
            nodes: plan.nodes.filter((n) => n.tempId !== tempId),
            edges: plan.edges.filter(
                (e) => e.fromTempId !== tempId && e.toTempId !== tempId
            ),
        });
    };

    const handleApply = async () => {
        if (!plan) return;

        const selectedNodes = plan.nodes.filter((n) => n.selected);
        if (selectedNodes.length === 0) {
            toast.error("Please select at least one node to create");
            return;
        }

        setStep("generating");
        setIsApplying(true);

        try {
            // Create nodes one by one and collect IDs
            const tempIdToRealId = new Map<string, string>();

            for (const node of selectedNodes) {
                const res = await fetch(`/api/projects/${projectId}/nodes`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: node.title,
                        description: node.description || "",
                        type: node.type,
                        ownerIds: [],
                        teamIds: node.suggestedTeamIds,
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    tempIdToRealId.set(node.tempId, data.id);
                }
            }

            // Create edges for selected nodes
            const selectedTempIds = new Set(selectedNodes.map((n) => n.tempId));

            for (const edge of plan.edges) {
                if (
                    selectedTempIds.has(edge.fromTempId) &&
                    selectedTempIds.has(edge.toTempId)
                ) {
                    const fromNodeId = tempIdToRealId.get(edge.fromTempId);
                    const toNodeId = tempIdToRealId.get(edge.toTempId);

                    if (fromNodeId && toNodeId) {
                        await fetch(`/api/projects/${projectId}/edges`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                fromNodeId,
                                toNodeId,
                                relation: edge.relation,
                            }),
                        });
                    }
                }
            }

            toast.success(
                `Created ${tempIdToRealId.size} node${tempIdToRealId.size > 1 ? "s" : ""}`
            );
            resetAndClose();
            onSuccess();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to create nodes");
            setStep("plan");
        } finally {
            setIsApplying(false);
        }
    };

    const resetAndClose = () => {
        setText("");
        setPlan(null);
        setStep("input");
        setEditingNodeId(null);
        setExpandedPhases(new Set());
        onOpenChange(false);
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case "TASK":
                return "bg-blue-100 text-blue-700";
            case "DECISION":
                return "bg-purple-100 text-purple-700";
            case "BLOCKER":
                return "bg-red-100 text-red-700";
            case "INFOREQ":
                return "bg-yellow-100 text-yellow-700";
            default:
                return "bg-gray-100 text-gray-700";
        }
    };

    const getInputTypeIcon = (type: string) => {
        switch (type) {
            case "keyword":
                return <Lightbulb className="w-4 h-4" />;
            case "outline":
                return <FileText className="w-4 h-4" />;
            case "meeting_notes":
                return <MessageSquare className="w-4 h-4" />;
            default:
                return <FileText className="w-4 h-4" />;
        }
    };

    const getInputTypeLabel = (type: string) => {
        switch (type) {
            case "keyword":
                return "키워드/아이디어";
            case "outline":
                return "개요";
            case "meeting_notes":
                return "회의록";
            default:
                return type;
        }
    };

    // Group nodes by phase
    const groupedNodes = plan?.nodes.reduce(
        (acc, node) => {
            const phase = node.phase || "Tasks";
            if (!acc[phase]) acc[phase] = [];
            acc[phase].push(node);
            return acc;
        },
        {} as Record<string, GeneratedPlanNode[]>
    );

    const togglePhase = (phase: string) => {
        setExpandedPhases((prev) => {
            const next = new Set(prev);
            if (next.has(phase)) {
                next.delete(phase);
            } else {
                next.add(phase);
            }
            return next;
        });
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && resetAndClose()}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                        {step === "input" && "Generate Nodes from Text"}
                        {step === "plan" && "Review Plan"}
                        {step === "generating" && "Creating Nodes..."}
                    </DialogTitle>
                    <DialogDescription>
                        {step === "input" &&
                            "Describe your idea, paste meeting notes, or enter a topic to generate a project plan."}
                        {step === "plan" &&
                            "Review the generated plan. You can edit nodes, change teams, or remove items before creating."}
                        {step === "generating" && "Please wait while nodes are being created..."}
                    </DialogDescription>
                </DialogHeader>

                {step === "input" && (
                    <div className="space-y-4 my-4 flex-1 overflow-hidden">
                        <div className="h-full flex flex-col">
                            <Label htmlFor="textInput">Your Input</Label>
                            <Textarea
                                id="textInput"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder={`Examples:\n• Short idea: "모바일 앱 출시"\n• Brief outline: "1. 기획 2. 디자인 3. 개발"\n• Meeting notes: "다음 주까지 API 완성, 프론트 개발은 그 이후..."`}
                                className="mt-2 min-h-[250px] max-h-[50vh] resize-none flex-1"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                                AI will detect the type of input and generate an appropriate plan.
                            </p>
                        </div>
                    </div>
                )}

                {step === "plan" && plan && (
                    <div className="space-y-4 my-4 flex-1 overflow-y-auto">
                        {/* Plan Summary */}
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-100">
                            <div className="flex items-center gap-2 mb-2">
                                <Badge
                                    variant="outline"
                                    className="flex items-center gap-1.5 bg-white"
                                >
                                    {getInputTypeIcon(plan.inputType)}
                                    {getInputTypeLabel(plan.inputType)}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                    {plan.nodes.filter((n) => n.selected).length} of {plan.nodes.length}{" "}
                                    nodes selected
                                </span>
                            </div>
                            {plan.summary && (
                                <p className="text-sm text-slate-700">{plan.summary}</p>
                            )}
                        </div>

                        {/* Nodes grouped by phase */}
                        <div className="space-y-3">
                            {groupedNodes &&
                                Object.entries(groupedNodes).map(([phase, nodes]) => (
                                    <Collapsible
                                        key={phase}
                                        open={expandedPhases.has(phase)}
                                        onOpenChange={() => togglePhase(phase)}
                                    >
                                        <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-slate-50 rounded-md transition-colors">
                                            {expandedPhases.has(phase) ? (
                                                <ChevronDown className="h-4 w-4 text-slate-500" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 text-slate-500" />
                                            )}
                                            <span className="font-medium text-sm">{phase}</span>
                                            <Badge variant="secondary" className="ml-auto text-xs">
                                                {nodes.filter((n) => n.selected).length}/{nodes.length}
                                            </Badge>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="pl-6 space-y-2 mt-2">
                                            {nodes.map((node) => (
                                                <div
                                                    key={node.tempId}
                                                    className={cn(
                                                        "p-3 rounded-lg border transition-all",
                                                        node.selected
                                                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                                            : "border-slate-200 opacity-50"
                                                    )}
                                                >
                                                    <div className="flex items-start gap-2">
                                                        {/* Checkbox */}
                                                        <div
                                                            onClick={() => toggleNode(node.tempId)}
                                                            className={cn(
                                                                "w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 cursor-pointer mt-0.5",
                                                                node.selected
                                                                    ? "bg-primary border-primary"
                                                                    : "border-slate-300 hover:border-slate-400"
                                                            )}
                                                        >
                                                            {node.selected && (
                                                                <Check className="w-3 h-3 text-white" />
                                                            )}
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0">
                                                            {editingNodeId === node.tempId ? (
                                                                <div className="space-y-2">
                                                                    <Input
                                                                        value={node.title}
                                                                        onChange={(e) =>
                                                                            updateNode(node.tempId, {
                                                                                title: e.target.value,
                                                                            })
                                                                        }
                                                                        className="h-8 text-sm font-medium"
                                                                        autoFocus
                                                                    />
                                                                    <Textarea
                                                                        value={node.description}
                                                                        onChange={(e) =>
                                                                            updateNode(node.tempId, {
                                                                                description: e.target.value,
                                                                            })
                                                                        }
                                                                        className="text-xs min-h-[60px]"
                                                                        placeholder="Description..."
                                                                    />
                                                                    <div className="flex gap-2">
                                                                        <Select
                                                                            value={node.type}
                                                                            onValueChange={(v) =>
                                                                                updateNode(node.tempId, {
                                                                                    type: v as any,
                                                                                })
                                                                            }
                                                                        >
                                                                            <SelectTrigger className="h-8 text-xs w-[100px]">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="TASK">Task</SelectItem>
                                                                                <SelectItem value="DECISION">
                                                                                    Decision
                                                                                </SelectItem>
                                                                                <SelectItem value="BLOCKER">
                                                                                    Blocker
                                                                                </SelectItem>
                                                                                <SelectItem value="INFOREQ">
                                                                                    Info Request
                                                                                </SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                        <Select
                                                                            value={node.suggestedTeamIds[0] || "none"}
                                                                            onValueChange={(v) =>
                                                                                updateNode(node.tempId, {
                                                                                    suggestedTeamIds: v === "none" ? [] : [v],
                                                                                })
                                                                            }
                                                                        >
                                                                            <SelectTrigger className="h-8 text-xs flex-1">
                                                                                <Users className="w-3 h-3 mr-1" />
                                                                                <SelectValue placeholder="Select team" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="none">No team</SelectItem>
                                                                                {teams.map((team) => (
                                                                                    <SelectItem key={team.id} value={team.id}>
                                                                                        {team.name}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-8"
                                                                            onClick={() => setEditingNodeId(null)}
                                                                        >
                                                                            Done
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <Badge
                                                                            className={cn(
                                                                                "text-[10px]",
                                                                                getTypeColor(node.type)
                                                                            )}
                                                                        >
                                                                            {node.type}
                                                                        </Badge>
                                                                        <span className="font-medium text-sm truncate">
                                                                            {node.title}
                                                                        </span>
                                                                    </div>
                                                                    {node.description && (
                                                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                                                            {node.description}
                                                                        </p>
                                                                    )}
                                                                    {node.suggestedTeamIds.length > 0 && (
                                                                        <div className="flex items-center gap-1 mt-1">
                                                                            <Users className="w-3 h-3 text-slate-400" />
                                                                            <span className="text-xs text-slate-500">
                                                                                {teams.find(
                                                                                    (t) => t.id === node.suggestedTeamIds[0]
                                                                                )?.name || "Unknown team"}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Actions */}
                                                        {editingNodeId !== node.tempId && (
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 text-slate-400 hover:text-slate-600"
                                                                    onClick={() => setEditingNodeId(node.tempId)}
                                                                >
                                                                    <Edit3 className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-7 w-7 text-slate-400 hover:text-red-500"
                                                                    onClick={() => deleteNode(node.tempId)}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </CollapsibleContent>
                                    </Collapsible>
                                ))}
                        </div>

                        {/* Edges preview */}
                        {plan.edges.length > 0 && (
                            <div className="pt-3 border-t">
                                <div className="text-xs font-medium text-muted-foreground mb-2">
                                    Dependencies ({plan.edges.length})
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {plan.edges.slice(0, 5).map((edge, idx) => {
                                        const from = plan.nodes.find((n) => n.tempId === edge.fromTempId);
                                        const to = plan.nodes.find((n) => n.tempId === edge.toTempId);
                                        return (
                                            <div
                                                key={idx}
                                                className="text-xs text-slate-600 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded"
                                            >
                                                <span className="truncate max-w-[100px]">
                                                    {from?.title || "?"}
                                                </span>
                                                <ArrowRight className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate max-w-[100px]">
                                                    {to?.title || "?"}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {plan.edges.length > 5 && (
                                        <span className="text-xs text-slate-400">
                                            +{plan.edges.length - 5} more
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {step === "generating" && (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="h-12 w-12 animate-spin text-purple-500 mb-4" />
                        <p className="text-sm text-muted-foreground">
                            Creating {plan?.nodes.filter((n) => n.selected).length || 0} nodes...
                        </p>
                    </div>
                )}

                <DialogFooter className="gap-2 mt-auto pt-4 border-t">
                    {step === "plan" && (
                        <Button
                            variant="outline"
                            onClick={() => setStep("input")}
                            className="mr-auto"
                        >
                            ← Back
                        </Button>
                    )}
                    {step === "plan" && (
                        <Button
                            variant="outline"
                            onClick={handleRegeneratePlan}
                            disabled={isGeneratingPlan}
                        >
                            {isGeneratingPlan ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4 mr-2" />
                            )}
                            Regenerate
                        </Button>
                    )}
                    <Button variant="outline" onClick={resetAndClose}>
                        Cancel
                    </Button>
                    {step === "input" && (
                        <Button onClick={handleGeneratePlan} disabled={isGeneratingPlan || !text.trim()}>
                            {isGeneratingPlan ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Generate Plan
                                </>
                            )}
                        </Button>
                    )}
                    {step === "plan" && (
                        <Button onClick={handleApply} disabled={isApplying}>
                            {isApplying ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4 mr-2" />
                                    Create {plan?.nodes.filter((n) => n.selected).length || 0} Nodes
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
