"use client";

import { useMemo } from "react";
import { ActionSection } from "@/components/action-center/ActionSection";
import { AlertCircle, Clock, Ban, CheckCircle2 } from "lucide-react";
import { NodeDTO, EdgeDTO } from "@/types"; // We will filter NodeDTO locally

interface ProjectMonitorProps {
    nodes: NodeDTO[];
    edges: EdgeDTO[];
    userId: string;
}

export function ProjectMonitor({ nodes, edges, userId }: ProjectMonitorProps) {
    // 1. Actionable: Nodes in this project ready to proceed (TODO/DOING & !BLOCKED & !WAITING)
    // Default: all users (per spec "Default: all users")
    // Optional toggle: "Only my actions" (Not implementing toggle yet, strictly following spec "Default: all users")
    // "Nodes in this project that are ready to proceed"

    const actionable = useMemo(() => {
        return nodes.filter(n =>
            (n.manualStatus === "TODO" || n.manualStatus === "DOING") &&
            n.computedStatus !== "BLOCKED" &&
            n.computedStatus !== "WAITING"
        );
    }, [nodes]);

    // 2. Waiting: Nodes in this project in WAITING state
    const waiting = useMemo(() => {
        return nodes.filter(n => n.computedStatus === "WAITING");
    }, [nodes]);

    // 3. Blocking: Nodes in this project blocking downstream nodes
    // Now using server-computed blocksCount
    const blocking = useMemo(() => {
        return nodes.filter(n => (n.blocksCount || 0) > 0);
    }, [nodes]);

    return (
        <div className="flex flex-col h-full bg-background border-l border-border w-[350px] shadow-xl overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/20">
                <h2 className="font-semibold text-lg">Project Monitor</h2>
                <p className="text-xs text-muted-foreground">Flow analysis for this project</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Actionable */}
                <ActionSection
                    title="Actionable"
                    icon={<CheckCircle2 className="h-4 w-4 text-blue-500" />}
                    items={actionable}
                    emptyState={<p className="text-sm">No actionable items.</p>}
                    renderItem={(item) => (
                        <div className="p-3">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{item.title}</span>
                                {item.ownerName && (
                                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                        {item.ownerName}
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {item.manualStatus}
                            </div>
                        </div>
                    )}
                />

                {/* Waiting */}
                <ActionSection
                    title="Waiting"
                    icon={<Clock className="h-4 w-4 text-yellow-500" />}
                    items={waiting}
                    emptyState={<p className="text-sm">No waiting items.</p>}
                    renderItem={(item) => (
                        <div className="p-3">
                            <div className="font-medium text-sm">{item.title}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex gap-2">
                                <span className="bg-yellow-500/10 text-yellow-600 px-1.5 rounded">
                                    {item.waitingReason || "Waiting"}
                                </span>
                            </div>
                        </div>
                    )}
                />

                {/* Blocking */}
                <ActionSection
                    title="Blocking"
                    icon={<Ban className="h-4 w-4 text-red-500" />}
                    items={blocking}
                    emptyState={<p className="text-sm">Nothing blocking flow.</p>}
                    renderItem={(item) => (
                        <div className="p-3">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{item.title}</span>
                                <span className="text-xs font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                                    {item.blocksCount}
                                </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Blocking downstream
                            </div>
                        </div>
                    )}
                />

            </div>
        </div>
    );
}
