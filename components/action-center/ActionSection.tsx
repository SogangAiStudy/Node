import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ActionSectionProps<T> {
    title: string;
    items: T[];
    renderItem: (item: T) => ReactNode;
    emptyState: ReactNode;
    className?: string;
    icon?: ReactNode;
}

export function ActionSection<T>({
    title,
    items,
    renderItem,
    emptyState,
    className,
    icon,
}: ActionSectionProps<T>) {
    return (
        <div className={cn("bg-card border border-border rounded-xl overflow-hidden shadow-sm", className)}>
            <div className="px-5 py-4 border-b border-border bg-muted/30">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    {icon}
                    {title}
                    {items.length > 0 && (
                        <span className="ml-auto text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {items.length}
                        </span>
                    )}
                </h2>
            </div>
            <div className="p-0">
                {items.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground bg-muted/5">
                        {emptyState}
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {items.map((item, index) => (
                            <div key={index} className="group hover:bg-muted/50 transition-colors">
                                {renderItem(item)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
