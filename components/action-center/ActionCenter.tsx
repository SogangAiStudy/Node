"use client";

import { useQuery } from "@tanstack/react-query";
import { ActionSection } from "./ActionSection";
import { AlertCircle, Clock, Ban, CheckCircle2, ArrowRight } from "lucide-react";
import { NodeDTO } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface WaitingItem extends NodeDTO {
    reason: string;
    responsible: string[];
    waitingSince: string;
}

interface BlockingItem extends NodeDTO {
    blockedCount: number;
    affectedProjects: string[];
}

interface ActionCenterData {
    myActions: NodeDTO[];
    waiting: WaitingItem[];
    blocking: BlockingItem[];
}

interface ActionCenterProps {
    orgId: string;
}

export function ActionCenter({ orgId }: ActionCenterProps) {
    const { data, isLoading, error } = useQuery<ActionCenterData>({
        queryKey: ["action-center", orgId],
        queryFn: async () => {
            const res = await fetch(`/api/action-center?orgId=${orgId}`);
            if (!res.ok) throw new Error("Failed to fetch actions");
            return res.json();
        },
        refetchInterval: 30000, // Refresh every 30s
    });

    if (isLoading) {
        return <ActionCenterSkeleton />;
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-500 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/20">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>Failed to load Action Center</p>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* 1. My Actions */}
            <ActionSection
                title="My Actions"
                icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
                items={data.myActions}
                emptyState={
                    <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-8 w-8 text-green-500/20" />
                        <p>You're all caught up! No immediate actions required.</p>
                    </div>
                }
                renderItem={(item) => (
                    <div className="p-4 flex items-start gap-3">
                        <div className="mt-1">
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <Link
                                    href={`/org/${item.orgId}/projects/${item.projectId}/graph?nodeId=${item.id}`}
                                    className="text-sm font-medium text-foreground hover:underline truncate block"
                                >
                                    {item.title}
                                </Link>
                                {item.dueAt && (
                                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                        Due {formatDistanceToNow(new Date(item.dueAt), { addSuffix: true })}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-medium text-primary/80">{item.projectName}</span>
                                <span>•</span>
                                <span className="capitalize">{item.manualStatus.toLowerCase().replace('_', ' ')}</span>
                            </div>
                        </div>
                        <Link
                            href={`/org/${item.orgId}/projects/${item.projectId}/graph?nodeId=${item.id}`}
                            className="text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full transition-colors self-center"
                        >
                            View
                        </Link>
                    </div>
                )}
            />

            {/* 2. Waiting */}
            <ActionSection
                title="Waiting"
                icon={<Clock className="h-4 w-4 text-yellow-500" />}
                items={data.waiting}
                emptyState={
                    <div className="flex flex-col items-center gap-2">
                        <Clock className="h-8 w-8 text-yellow-500/20" />
                        <p>You aren't waiting on anyone currently.</p>
                    </div>
                }
                renderItem={(item) => (
                    <div className="p-4 flex items-start gap-4">
                        <div className="mt-1">
                            <div className="h-2 w-2 rounded-full bg-yellow-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <Link
                                    href={`/org/${item.orgId}/projects/${item.projectId}/graph?nodeId=${item.id}`}
                                    className="text-sm font-medium text-foreground hover:underline truncate block"
                                >
                                    {item.title}
                                </Link>
                                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                    {formatDistanceToNow(new Date(item.waitingSince), { addSuffix: true })}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                <span className="text-muted-foreground">{item.projectName}</span>
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20">
                                    <span className="font-medium">{item.reason}</span>
                                    {item.responsible.length > 0 && (
                                        <>
                                            <span className="opacity-50">from</span>
                                            <span className="font-medium">{item.responsible.join(", ")}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            />

            {/* 3. Blocking */}
            <ActionSection
                title="Blocking"
                icon={<Ban className="h-4 w-4 text-red-500" />}
                items={data.blocking}
                emptyState={
                    <div className="flex flex-col items-center gap-2">
                        <Ban className="h-8 w-8 text-red-500/20" />
                        <p>Good job! You aren't blocking anyone's work.</p>
                    </div>
                }
                renderItem={(item) => (
                    <div className="p-4 flex items-start gap-4">
                        <div className="mt-1">
                            <div className="h-2 w-2 rounded-full bg-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <Link
                                    href={`/org/${item.orgId}/projects/${item.projectId}/graph?nodeId=${item.id}`}
                                    className="text-sm font-medium text-foreground hover:underline truncate block"
                                >
                                    {item.title}
                                </Link>
                                <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900/30">
                                    Blocks {item.blockedCount} item{item.blockedCount !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="text-xs text-muted-foreground flex flex-col gap-1">
                                <span>{item.projectName}</span>
                                {item.affectedProjects.length > 0 && (
                                    <span className="text-red-500/80">
                                        Impacts: {item.affectedProjects.join(", ")}
                                    </span>
                                )}
                            </div>
                        </div>
                        <Link
                            href={`/org/${item.orgId}/projects/${item.projectId}/graph?nodeId=${item.id}`}
                            className="text-xs font-medium text-foreground bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-full transition-colors self-center flex items-center gap-1"
                        >
                            Unblock <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>
                )}
            />
        </div>
    );
}

function ActionCenterSkeleton() {
    return (
        <div className="space-y-8">
            {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm h-48">
                    <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="p-4 space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </div>
            ))}
        </div>
    );
}
