"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FavoriteButtonProps {
    projectId: string;
    initialIsFavorite: boolean;
    className?: string;
}

export function FavoriteButton({
    projectId,
    initialIsFavorite,
    className,
}: FavoriteButtonProps) {
    const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
    const [isLoading, setIsLoading] = useState(false);

    const toggleFavorite = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setIsLoading(true);
        const optimisticValue = !isFavorite;
        setIsFavorite(optimisticValue);

        try {
            const res = await fetch(`/api/projects/${projectId}/favorite`, {
                method: "PATCH",
            });

            if (!res.ok) throw new Error("Failed to toggle favorite");

            const data = await res.json();
            setIsFavorite(data.isFavorite);
        } catch (error) {
            // Revert on error
            setIsFavorite(!optimisticValue);
            toast.error("Failed to update favorite");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            className={cn(
                "h-8 w-8 hover:bg-[#2c2d31]",
                className
            )}
            onClick={toggleFavorite}
            disabled={isLoading}
        >
            <Star
                className={cn(
                    "h-4 w-4 transition-all",
                    isFavorite
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-[#7b7c7e] hover:text-yellow-400"
                )}
            />
        </Button>
    );
}
