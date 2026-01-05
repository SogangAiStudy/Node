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
import { Loader2, ArrowRight, ArrowDown, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateGridLayout, LayoutNode, LayoutEdge } from "@/lib/utils/graph-layout-utils";
import dagre from "dagre";

interface OrganizeDialogProps {
    projectId: string;
    nodes: Array<LayoutNode>;
    edges: Array<LayoutEdge>;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApply: (positions: Array<{ nodeId: string; x: number; y: number }>) => void;
}

const nodeWidth = 240;
const nodeHeight = 120;

type LayoutDirection = "LR" | "TB" | "GRID";

export function OrganizeDialog({
    projectId,
    nodes,
    edges,
    open,
    onOpenChange,
    onApply,
}: OrganizeDialogProps) {
    const [isApplying, setIsApplying] = useState(false);
    const [selectedDirection, setSelectedDirection] = useState<LayoutDirection>("GRID");

    const calculateLayout = (direction: LayoutDirection) => {
        if (direction === "GRID") {
            return calculateGridLayout(nodes, edges);
        }

        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));

        dagreGraph.setGraph({
            rankdir: direction,
            ranksep: 100,
            nodesep: 60,
            edgesep: 25,
            marginx: 30,
            marginy: 30,
            acyclicer: "greedy",
            ranker: "network-simplex",
        });

        nodes.forEach((node) => {
            dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
        });

        edges.forEach((edge) => {
            dagreGraph.setEdge(edge.source, edge.target);
        });

        dagre.layout(dagreGraph);

        const newPositions: Array<{ nodeId: string; x: number; y: number }> = [];

        nodes.forEach((node) => {
            const nodeWithPosition = dagreGraph.node(node.id);
            if (nodeWithPosition) {
                newPositions.push({
                    nodeId: node.id,
                    x: Math.round(nodeWithPosition.x - nodeWidth / 2),
                    y: Math.round(nodeWithPosition.y - nodeHeight / 2),
                });
            }
        });

        return newPositions;
    };

    const handleApply = async () => {
        if (nodes.length === 0) {
            toast.error("No nodes to organize");
            return;
        }

        setIsApplying(true);

        try {
            // Calculate new positions
            const newPositions = calculateLayout(selectedDirection);

            // Save to database
            const res = await fetch(`/api/projects/${projectId}/nodes/batch-positions`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ positions: newPositions }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to save positions");
            }

            // Apply to canvas
            onApply(newPositions);

            toast.success(`Reorganized ${nodes.length} nodes`);
            onOpenChange(false);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to organize");
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-blue-500" />
                        Organize Graph
                    </DialogTitle>
                    <DialogDescription>
                        Automatically arrange {nodes.length} nodes for maximum clarity.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6">
                    <div className="text-sm font-medium text-slate-700 mb-3">
                        Choose Layout Strategy
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {/* Grid Layout (Mixed) */}
                        <button
                            onClick={() => setSelectedDirection("GRID")}
                            className={cn(
                                "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 col-span-2",
                                selectedDirection === "GRID"
                                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                            )}
                        >
                            <div className="flex flex-col gap-1.5 items-center text-slate-500">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded bg-slate-400" />
                                    <div className="w-3 h-3 rounded bg-slate-400" />
                                    <div className="w-3 h-3 rounded bg-slate-400" />
                                </div>
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded bg-slate-300" />
                                    <div className="w-3 h-3 rounded bg-slate-300" />
                                </div>
                            </div>
                            <span className={cn(
                                "text-sm font-medium",
                                selectedDirection === "GRID" ? "text-blue-700" : "text-slate-600"
                            )}>
                                Mixed (Grid)
                            </span>
                        </button>

                        {/* Horizontal Layout */}
                        <button
                            onClick={() => setSelectedDirection("LR")}
                            className={cn(
                                "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                                selectedDirection === "LR"
                                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                            )}
                        >
                            <div className="flex items-center gap-1 text-slate-500">
                                <div className="w-4 h-4 rounded bg-slate-300" />
                                <ArrowRight className="w-4 h-4" />
                                <div className="w-4 h-4 rounded bg-slate-300" />
                            </div>
                            <span className={cn(
                                "text-sm font-medium",
                                selectedDirection === "LR" ? "text-blue-700" : "text-slate-600"
                            )}>
                                Horizontal
                            </span>
                        </button>

                        {/* Vertical Layout */}
                        <button
                            onClick={() => setSelectedDirection("TB")}
                            className={cn(
                                "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                                selectedDirection === "TB"
                                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                            )}
                        >
                            <div className="flex flex-col items-center gap-1 text-slate-500">
                                <div className="w-4 h-4 rounded bg-slate-300" />
                                <ArrowDown className="w-4 h-4" />
                                <div className="w-4 h-4 rounded bg-slate-300" />
                            </div>
                            <span className={cn(
                                "text-sm font-medium",
                                selectedDirection === "TB" ? "text-blue-700" : "text-slate-600"
                            )}>
                                Vertical
                            </span>
                        </button>
                    </div>

                    <p className="text-xs text-muted-foreground mt-4 text-center">
                        {selectedDirection === "GRID" && "Topological grid (5 columns). Best for most projects."}
                        {selectedDirection === "LR" && "Strict left-to-right dependency flow."}
                        {selectedDirection === "TB" && "Strict top-to-bottom dependency flow."}
                    </p>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleApply} disabled={isApplying || nodes.length === 0}>
                        {isApplying ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Organizing...
                            </>
                        ) : (
                            <>
                                <Layers className="w-4 h-4 mr-2" />
                                Apply Layout
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
