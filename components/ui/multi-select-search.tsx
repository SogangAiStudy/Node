"use client";

import * as React from "react";
import { Search, Check, User, Users, X } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export interface SelectItem {
    id: string;
    name: string;
    subtitle?: string;
    image?: string;
    type: "user" | "team";
}

interface MultiSelectSearchProps {
    items: SelectItem[];
    selectedIds: string[];
    onSelect: (id: string) => void;
    onRemove: (id: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    className?: string;
}

export function MultiSelectSearch({
    items,
    selectedIds,
    onSelect,
    onRemove,
    placeholder = "Select...",
    searchPlaceholder = "Search...",
    className,
}: MultiSelectSearchProps) {
    const [search, setSearch] = React.useState("");
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const filteredItems = items.filter((item) =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.subtitle?.toLowerCase().includes(search.toLowerCase())
    );

    const selectedItems = items.filter((item) => selectedIds.includes(item.id));

    // Group by suggested (not selected) and others
    const suggestedItems = filteredItems.filter(item => !selectedIds.includes(item.id));

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEsc);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEsc);
        };
    }, []);

    return (
        <div className={cn("relative w-full", className)} ref={containerRef}>
            <div
                className={cn(
                    "flex min-h-10 w-full flex-wrap gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-text focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                    isOpen && "ring-2 ring-ring ring-offset-2"
                )}
                onClick={() => setIsOpen(true)}
            >
                {selectedItems.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {selectedItems.map((item) => (
                            <Badge
                                key={item.id}
                                variant="secondary"
                                className="flex items-center gap-1 pr-1"
                            >
                                {item.name}
                                <button
                                    type="button"
                                    className="rounded-full outline-none focus:ring-2 focus:ring-ring"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemove(item.id);
                                    }}
                                >
                                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                ) : null}
                <input
                    className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                    placeholder={selectedItems.length === 0 ? placeholder : ""}
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                />
            </div>

            {isOpen && (
                <div className="absolute z-50 mt-2 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95">
                    <div className="p-2">
                        <div className="flex items-center gap-2 px-2 pb-2 border-b">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <input
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                placeholder={searchPlaceholder}
                                autoFocus
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <ScrollArea className="h-64 mt-1">
                            <div className="p-1">
                                {selectedItems.length > 0 && (
                                    <div className="mb-2">
                                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                            Selected
                                        </div>
                                        {selectedItems.map((item) => (
                                            <button
                                                key={item.id}
                                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                                                onClick={() => onRemove(item.id)}
                                            >
                                                <ItemRow item={item} isSelected={true} />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div>
                                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                        {search ? "Search Results" : "Suggested"}
                                    </div>
                                    {suggestedItems.length > 0 ? (
                                        suggestedItems.map((item) => (
                                            <button
                                                key={item.id}
                                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                                                onClick={() => onSelect(item.id)}
                                            >
                                                <ItemRow item={item} isSelected={false} />
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                            No items found.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            )}
        </div>
    );
}

function ItemRow({ item, isSelected }: { item: SelectItem; isSelected: boolean }) {
    return (
        <>
            <Avatar className="h-9 w-9 border">
                {item.image && <AvatarImage src={item.image} alt={item.name} />}
                <AvatarFallback className={cn(
                    "text-xs font-semibold",
                    item.type === "team" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "bg-muted"
                )}>
                    {item.type === "team" ? <Users className="h-4 w-4" /> : getInitials(item.name)}
                </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col overflow-hidden text-left ml-1">
                <span className="truncate font-medium text-sm">{item.name}</span>
                {item.subtitle && (
                    <span className="truncate text-xs text-muted-foreground">
                        {item.subtitle}
                    </span>
                )}
            </div>
            {isSelected ? (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3 stroke-[3]" />
                </div>
            ) : (
                <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 hover:border-muted-foreground/60 transition-colors" />
            )}
        </>
    );
}
