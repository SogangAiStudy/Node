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
import { toast } from "sonner";
import { Loader2, Sparkles, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ClusterSuggestion {
    name: string;
    nodeIds: string[];
    reason: string;
}

interface AutoOrganizeDialogProps {
    projectId: string;
    nodes: Array<{ id: string; title: string }>;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApply: (clusters: ClusterSuggestion[], layout: string) => void;
}

export function AutoOrganizeDialog({
    projectId,
    nodes,
    open,
    onOpenChange,
    onApply,
}: AutoOrganizeDialogProps) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [clusters, setClusters] = useState<ClusterSuggestion[]>([]);
    const [layoutSuggestion, setLayoutSuggestion] = useState<string>("");
    const [hasAnalyzed, setHasAnalyzed] = useState(false);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        try {
            const res = await fetch("/api/ai/organize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to analyze");
            }

            const data = await res.json();
            setClusters(data.clusters || []);
            setLayoutSuggestion(data.layoutSuggestion || "horizontal");
            setHasAnalyzed(true);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to analyze project");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleApply = () => {
        onApply(clusters, layoutSuggestion);
        onOpenChange(false);
    };

    const resetAndClose = () => {
        setClusters([]);
        setLayoutSuggestion("");
        setHasAnalyzed(false);
        onOpenChange(false);
    };

    const getNodeTitle = (nodeId: string) => {
        return nodes.find((n) => n.id === nodeId)?.title || "Unknown";
    };

    const layoutLabels: Record<string, string> = {
        horizontal: "Horizontal (← →)",
        vertical: "Vertical (↑ ↓)",
        radial: "Radial (Hub & Spoke)",
        hierarchical: "Hierarchical (Layered)",
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && resetAndClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-purple-500" />
                        Auto-Organize Graph
                    </DialogTitle>
                    <DialogDescription>
                        AI will analyze your project structure and suggest logical groupings.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-4">
                    {!hasAnalyzed ? (
                        <div className="text-center py-8">
                            <Sparkles className="h-12 w-12 text-purple-200 mx-auto mb-4" />
                            <p className="text-sm text-muted-foreground mb-4">
                                Click analyze to get AI suggestions for organizing your {nodes.length} nodes.
                            </p>
                            <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                                {isAnalyzing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Analyze Structure
                                    </>
                                )}
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Layout Suggestion */}
                            <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                                <div className="text-xs font-medium text-purple-700 mb-1">
                                    Suggested Layout
                                </div>
                                <div className="text-sm font-semibold text-purple-900">
                                    {layoutLabels[layoutSuggestion] || layoutSuggestion}
                                </div>
                            </div>

                            {/* Clusters */}
                            {clusters.length > 0 ? (
                                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                    <div className="text-sm font-medium text-slate-700">
                                        Suggested Clusters ({clusters.length})
                                    </div>
                                    {clusters.map((cluster, index) => (
                                        <div
                                            key={index}
                                            className="p-3 rounded-lg border border-slate-200 bg-white"
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge variant="secondary" className="text-xs">
                                                    {cluster.nodeIds.length} nodes
                                                </Badge>
                                                <span className="font-medium text-sm">{cluster.name}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mb-2">
                                                {cluster.reason}
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {cluster.nodeIds.slice(0, 5).map((nodeId) => (
                                                    <span
                                                        key={nodeId}
                                                        className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded"
                                                    >
                                                        {getNodeTitle(nodeId)}
                                                    </span>
                                                ))}
                                                {cluster.nodeIds.length > 5 && (
                                                    <span className="text-[10px] text-muted-foreground">
                                                        +{cluster.nodeIds.length - 5} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-sm text-muted-foreground">
                                    No specific clusters suggested for this project structure.
                                </div>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={resetAndClose}>
                        Cancel
                    </Button>
                    {hasAnalyzed && (
                        <Button onClick={handleApply}>
                            Apply Suggestions
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
