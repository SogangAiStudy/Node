"use client";

import { useState } from "react";
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
import { toast } from "sonner";
import { Loader2, Sparkles, Check, ArrowRight, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface GeneratedNode {
    title: string;
    description?: string;
    type: "TASK" | "DECISION" | "BLOCKER" | "INFOREQ";
    selected?: boolean;
}

interface GeneratedEdge {
    fromIndex: number;
    toIndex: number;
    relation: "DEPENDS_ON" | "APPROVAL_BY";
}

interface GenerateNodesDialogProps {
    projectId: string;
    orgId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function GenerateNodesDialog({
    projectId,
    orgId,
    open,
    onOpenChange,
    onSuccess,
}: GenerateNodesDialogProps) {
    const [text, setText] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [generatedNodes, setGeneratedNodes] = useState<GeneratedNode[]>([]);
    const [generatedEdges, setGeneratedEdges] = useState<GeneratedEdge[]>([]);
    const [step, setStep] = useState<"input" | "preview">("input");

    const handleGenerate = async () => {
        if (!text.trim()) {
            toast.error("Please enter some text to analyze");
            return;
        }

        setIsGenerating(true);
        try {
            const res = await fetch("/api/ai/generate-nodes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId, text }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to generate nodes");
            }

            const data = await res.json();
            setGeneratedNodes((data.nodes || []).map((n: GeneratedNode) => ({ ...n, selected: true })));
            setGeneratedEdges(data.edges || []);
            setStep("preview");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to generate nodes");
        } finally {
            setIsGenerating(false);
        }
    };

    const toggleNode = (index: number) => {
        setGeneratedNodes((prev) =>
            prev.map((n, i) => (i === index ? { ...n, selected: !n.selected } : n))
        );
    };

    const handleApply = async () => {
        const selectedNodes = generatedNodes.filter((n) => n.selected);
        if (selectedNodes.length === 0) {
            toast.error("Please select at least one node to create");
            return;
        }

        setIsApplying(true);
        try {
            // Create nodes one by one
            const createdNodeIds: string[] = [];
            for (const node of selectedNodes) {
                const res = await fetch(`/api/projects/${projectId}/nodes`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: node.title,
                        description: node.description || "",
                        type: node.type,
                        ownerIds: [],
                        teamIds: [],
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    createdNodeIds.push(data.id);
                }
            }

            // Create edges for selected nodes
            const selectedIndices = generatedNodes
                .map((n, i) => (n.selected ? i : -1))
                .filter((i) => i !== -1);

            for (const edge of generatedEdges) {
                const fromIdx = selectedIndices.indexOf(edge.fromIndex);
                const toIdx = selectedIndices.indexOf(edge.toIndex);

                if (fromIdx !== -1 && toIdx !== -1) {
                    const fromNodeId = createdNodeIds[fromIdx];
                    const toNodeId = createdNodeIds[toIdx];

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

            toast.success(`Created ${createdNodeIds.length} node${createdNodeIds.length > 1 ? "s" : ""}`);
            resetAndClose();
            onSuccess();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to create nodes");
        } finally {
            setIsApplying(false);
        }
    };

    const resetAndClose = () => {
        setText("");
        setGeneratedNodes([]);
        setGeneratedEdges([]);
        setStep("input");
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

    return (
        <Dialog open={open} onOpenChange={(v) => !v && resetAndClose()}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                        Generate Nodes from Text
                    </DialogTitle>
                    <DialogDescription>
                        {step === "input"
                            ? "Paste meeting notes, requirements, or any text to automatically extract tasks."
                            : "Review and select which nodes to create."}
                    </DialogDescription>
                </DialogHeader>

                {step === "input" ? (
                    <div className="space-y-4 my-4">
                        <div>
                            <Label htmlFor="textInput">Your Text</Label>
                            <Textarea
                                id="textInput"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Paste your meeting notes, requirements, or task list here..."
                                className="mt-2 min-h-[300px] max-h-[50vh] resize-none"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                AI will extract tasks, decisions, and blockers from this text.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 my-4 max-h-[400px] overflow-y-auto">
                        <div className="text-sm text-muted-foreground mb-2">
                            {generatedNodes.filter((n) => n.selected).length} of {generatedNodes.length} selected
                        </div>
                        {generatedNodes.map((node, index) => (
                            <div
                                key={index}
                                onClick={() => toggleNode(index)}
                                className={cn(
                                    "p-3 rounded-lg border cursor-pointer transition-all",
                                    node.selected
                                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                        : "border-slate-200 opacity-50"
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge className={cn("text-[10px]", getTypeColor(node.type))}>
                                                {node.type}
                                            </Badge>
                                            <span className="font-medium text-sm">{node.title}</span>
                                        </div>
                                        {node.description && (
                                            <p className="text-xs text-muted-foreground">{node.description}</p>
                                        )}
                                    </div>
                                    <div
                                        className={cn(
                                            "w-5 h-5 rounded border flex items-center justify-center flex-shrink-0",
                                            node.selected ? "bg-primary border-primary" : "border-slate-300"
                                        )}
                                    >
                                        {node.selected && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {generatedEdges.length > 0 && (
                            <div className="pt-2 border-t">
                                <div className="text-xs font-medium text-muted-foreground mb-2">
                                    Dependencies ({generatedEdges.length})
                                </div>
                                {generatedEdges.map((edge, index) => (
                                    <div key={index} className="text-xs text-slate-600 flex items-center gap-1">
                                        <span className="truncate max-w-[150px]">
                                            {generatedNodes[edge.fromIndex]?.title}
                                        </span>
                                        <ArrowRight className="w-3 h-3 flex-shrink-0" />
                                        <span className="truncate max-w-[150px]">
                                            {generatedNodes[edge.toIndex]?.title}
                                        </span>
                                        <Badge variant="outline" className="text-[9px] ml-1">
                                            {edge.relation}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter className="gap-2">
                    {step === "preview" && (
                        <Button variant="outline" onClick={() => setStep("input")} className="mr-auto">
                            ← Back
                        </Button>
                    )}
                    <Button variant="outline" onClick={resetAndClose}>
                        Cancel
                    </Button>
                    {step === "input" ? (
                        <Button onClick={handleGenerate} disabled={isGenerating || !text.trim()}>
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Generate
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button onClick={handleApply} disabled={isApplying}>
                            {isApplying ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4 mr-2" />
                                    Create {generatedNodes.filter((n) => n.selected).length} Nodes
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
