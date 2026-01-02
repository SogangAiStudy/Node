"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, FolderKanban, Folder as FolderIcon, Command } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface GlobalSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    orgId?: string;
    onSearch: (query: string) => { projects: any[]; folders: any[] };
    onSelect: (item: any) => void;
}

export function GlobalSearchModal({
    isOpen,
    onClose,
    orgId,
    onSearch,
    onSelect,
}: GlobalSearchModalProps) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<{ projects: any[]; folders: any[] }>({
        projects: [],
        folders: [],
    });
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setResults({ projects: [], folders: [] });
            setSelectedIndex(0);
        }
    }, [isOpen]);

    useEffect(() => {
        const res = onSearch(query);
        setResults(res);
        setSelectedIndex(0);
    }, [query, onSearch]);

    const flatResults = [
        ...results.folders.map(s => ({ ...s, type: "folder" as const })),
        ...results.projects.map(p => ({ ...p, type: "project" as const })),
    ];

    const handleSelect = useCallback((item: any) => {
        onClose();
        if (item.type === "folder") {
            router.push(`/org/${orgId}/projects#folder-${item.id}`);
        } else {
            router.push(`/org/${orgId}/projects/${item.id}/graph`);
        }
    }, [orgId, onClose, router]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % Math.max(1, flatResults.length));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + flatResults.length) % Math.max(1, flatResults.length));
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (flatResults[selectedIndex]) {
                    handleSelect(flatResults[selectedIndex]);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, flatResults, selectedIndex, handleSelect]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden bg-[#1a1b1e] border-[#2c2d31] shadow-2xl top-[20%] translate-y-0">
                <div className="flex items-center px-4 border-b border-[#2c2d31]">
                    <Search className="h-5 w-5 text-[#7b7c7e] mr-3" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search projects or subjects..."
                        className="flex-1 h-14 bg-transparent border-none text-[16px] text-white focus-visible:ring-0 placeholder:text-[#7b7c7e]"
                        autoFocus
                    />
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#2c2d31] border border-[#3b3c40] text-[10px] text-[#7b7c7e] font-bold uppercase">
                        Esc
                    </div>
                </div>

                <ScrollArea className="max-h-[400px]">
                    <div className="p-2">
                        {query.trim() === "" ? (
                            <div className="px-4 py-8 text-center space-y-2">
                                <Command className="h-10 w-10 text-[#2c2d31] mx-auto" />
                                <p className="text-sm text-[#7b7c7e]">Type to search your workspace...</p>
                            </div>
                        ) : flatResults.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <p className="text-sm text-[#7b7c7e]">No results found for "{query}"</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {flatResults.map((item, index) => (
                                    <button
                                        key={`${item.type}-${item.id}`}
                                        onClick={() => handleSelect(item)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        className={cn(
                                            "w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors group",
                                            index === selectedIndex ? "bg-[#2c2d31] text-white" : "text-[#d1d2d5] hover:bg-[#2c2d31]/50"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "p-1.5 rounded-md",
                                                item.type === "folder" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
                                            )}>
                                                {item.type === "folder" ? (
                                                    <FolderIcon className="h-4 w-4" />
                                                ) : (
                                                    <FolderKanban className="h-4 w-4" />
                                                )}
                                            </div>
                                            <div className="flex flex-col items-start translate-y-[-1px]">
                                                <span className="text-[14px] font-medium leading-tight">{item.name}</span>
                                                <span className="text-[11px] text-[#7b7c7e] leading-tight">
                                                    {item.type === "folder" ? "Folder" : "Project"}
                                                </span>
                                            </div>
                                        </div>
                                        {index === selectedIndex && (
                                            <div className="text-[10px] text-[#7b7c7e] font-bold uppercase flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span>Select</span>
                                                <div className="px-1 py-0.5 rounded bg-[#3b3c40] border border-[#4c4d52]">
                                                    ↵
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="px-4 py-2 bg-[#16161a] border-t border-[#2c2d31] flex items-center justify-between text-[11px] text-[#7b7c7e]">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                            <kbd className="px-1 py-0.5 rounded bg-[#2c2d31] border border-[#3b3c40]">↑↓</kbd>
                            Navigate
                        </span>
                        <span className="flex items-center gap-1.5">
                            <kbd className="px-1 py-0.5 rounded bg-[#2c2d31] border border-[#3b3c40]">↵</kbd>
                            Select
                        </span>
                    </div>
                    <span>Search in {orgId}</span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
