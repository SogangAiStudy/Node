"use client";

import { useMemo, useState } from "react";
import { NodeDTO, EdgeDTO } from "@/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Ban, ChevronDown, ChevronRight, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ActionCenterBarProps {
    nodes: NodeDTO[];
    edges: EdgeDTO[];
    userId: string;
    onNodeClick?: (nodeId: string) => void;
}

interface ActionCategory {
    id: string;
    title: string;
    icon: React.ReactNode;
    colorClass: string;
    badgeClass: string;
    items: NodeDTO[];
}

export function ActionCenterBar({ nodes, edges, userId, onNodeClick }: ActionCenterBarProps) {
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    const isOwner = (node: NodeDTO) => {
        return node.ownerId === userId || node.owners?.some((o: any) => o.id === userId);
    };

    // Actionable: Nodes ready to proceed (TODO/DOING & !BLOCKED & !WAITING)
    const actionable = useMemo(() => {
        return nodes.filter(n =>
            isOwner(n) &&
            (n.manualStatus === "TODO" || n.manualStatus === "DOING") &&
            n.computedStatus !== "BLOCKED" &&
            n.computedStatus !== "WAITING"
        );
    }, [nodes, userId]);

    // Waiting: Nodes I own that are in WAITING or BLOCKED state
    const waiting = useMemo(() => {
        return nodes.filter(n =>
            isOwner(n) &&
            (n.computedStatus === "WAITING" || n.computedStatus === "BLOCKED")
        );
    }, [nodes, userId]);

    // Blocking: Nodes I own that are blocking downstream nodes owned by OTHERS
    const blocking = useMemo(() => {
        return nodes.filter(myNode => {
            if (!isOwner(myNode) || myNode.manualStatus === "DONE") return false;

            // Find if any node depending on this one is owned by someone else
            const hasDependentOther = edges.some(edge => {
                if (edge.toNodeId !== myNode.id || edge.relation !== "DEPENDS_ON") return false;
                const blockedNode = nodes.find(n => n.id === edge.fromNodeId);
                // Only count if blocking SOMEONE ELSE (not myself) and they actually have an owner
                const isBlockedNodeOwnedByMe = blockedNode && isOwner(blockedNode);
                const hasOwner = blockedNode && (blockedNode.ownerId || (blockedNode.owners && blockedNode.owners.length > 0));

                return blockedNode && !isBlockedNodeOwnedByMe && hasOwner;
            });

            return hasDependentOther;
        });
    }, [nodes, edges, userId]);

    const categories: ActionCategory[] = [
        {
            id: "actionable",
            title: "Do Now",
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            colorClass: "text-blue-600",
            badgeClass: "bg-blue-100 text-blue-700",
            items: actionable,
        },
        {
            id: "waiting",
            title: "Waiting",
            icon: <Clock className="h-3.5 w-3.5" />,
            colorClass: "text-yellow-600",
            badgeClass: "bg-yellow-100 text-yellow-700",
            items: waiting,
        },
        {
            id: "blocking",
            title: "Blocking",
            icon: <Ban className="h-3.5 w-3.5" />,
            colorClass: "text-red-600",
            badgeClass: "bg-red-100 text-red-700",
            items: blocking,
        },
    ];

    const totalActions = actionable.length + waiting.length + blocking.length;

    const toggleCategory = (id: string) => {
        setExpandedCategory(expandedCategory === id ? null : id);
    };

    return (
        <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 shadow-sm">
            {/* Compact Header Row */}
            <div className="px-4 py-3 flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-orange-500" />
                    <span className="font-semibold text-sm text-slate-800">Action Center</span>
                    {totalActions > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700">
                            {totalActions}
                        </Badge>
                    )}
                </div>

                {/* Category Buttons */}
                <div className="flex items-center gap-2">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => toggleCategory(cat.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                expandedCategory === cat.id
                                    ? "bg-slate-200 text-slate-900"
                                    : "hover:bg-slate-100 text-slate-600"
                            )}
                        >
                            <span className={cat.colorClass}>{cat.icon}</span>
                            <span>{cat.title}</span>
                            {cat.items.length > 0 && (
                                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", cat.badgeClass)}>
                                    {cat.items.length}
                                </span>
                            )}
                            {expandedCategory === cat.id ? (
                                <ChevronDown className="h-3 w-3 text-slate-400" />
                            ) : (
                                <ChevronRight className="h-3 w-3 text-slate-400" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Expanded Category Content */}
            {expandedCategory && (
                <div className="px-4 pb-3">
                    <div className="bg-white rounded-lg border border-slate-200 shadow-inner max-h-[200px] overflow-y-auto">
                        {categories
                            .find((c) => c.id === expandedCategory)
                            ?.items.map((item) => {
                                // Determine reasons
                                const isOwner = item.owners?.some((o: any) => o.id === userId) || item.ownerId === userId;
                                const isTeam = item.teams && item.teams.length > 0;

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => onNodeClick?.(item.id)}
                                        className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-medium text-sm text-slate-800 truncate">{item.title}</span>
                                                {item.waitingReason && (
                                                    <span className="text-[10px] text-muted-foreground truncate">
                                                        {item.waitingReason}
                                                    </span>
                                                )}
                                                {expandedCategory === "blocking" && (item.blocksCount || 0) > 0 && (
                                                    <span className="text-[10px] text-red-500 font-medium whitespace-nowrap">
                                                        Blocks {item.blocksCount} item{item.blocksCount !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                            {/* OWNER/TEAM Badges */}
                                            {isOwner && (
                                                <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0">
                                                    Owner
                                                </span>
                                            )}
                                            {isTeam && !isOwner && item.teams?.map((t: any) => (
                                                <span key={t.id} className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                                    {t.name}
                                                </span>
                                            ))}
                                        </div>
                                        <Badge
                                            variant={item.computedStatus === "BLOCKED" ? "destructive" : "outline"}
                                            className="text-[9px] uppercase ml-2 flex-shrink-0"
                                        >
                                            {item.computedStatus}
                                        </Badge>
                                    </div>
                                );
                            }) || (
                                <div className="p-4 text-center text-sm text-slate-400">
                                    No items in this category
                                </div>
                            )}
                        {categories.find((c) => c.id === expandedCategory)?.items.length === 0 && (
                            <div className="p-4 text-center text-sm text-slate-400">
                                No items in this category
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
