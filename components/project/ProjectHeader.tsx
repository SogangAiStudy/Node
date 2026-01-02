"use client";

import { useState } from "react";
import { Star, Share2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Collaborator {
    id: string;
    name: string;
    email?: string;
    image?: string;
}

interface ProjectHeaderProps {
    projectId: string;
    projectName: string;
    orgId: string;
    collaborators?: Collaborator[];
    isFavorite?: boolean;
    onFavoriteToggle?: (isFavorite: boolean) => void;
    onShare?: () => void;
}

export function ProjectHeader({
    projectId,
    projectName,
    orgId,
    collaborators = [],
    isFavorite = false,
    onFavoriteToggle,
    onShare,
}: ProjectHeaderProps) {
    const [favorite, setFavorite] = useState(isFavorite);

    const handleFavoriteClick = () => {
        const newState = !favorite;
        setFavorite(newState);
        onFavoriteToggle?.(newState);
        // TODO: Persist to backend
    };

    const handleShareClick = () => {
        onShare?.();
        // TODO: Open share modal
    };

    // Mock collaborators if none provided
    const displayCollaborators = collaborators.length > 0
        ? collaborators
        : [
            { id: "1", name: "User 1", email: "user1@example.com" },
            { id: "2", name: "User 2", email: "user2@example.com" },
        ];

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div className="sticky top-0 z-50 flex items-center justify-end gap-2 px-6 py-2 border-b border-border bg-[#1a1b1e]/95 backdrop-blur supports-[backdrop-filter]:bg-[#1a1b1e]/95">
            {/* Collaborators */}
            <div className="flex items-center -space-x-2">
                {displayCollaborators.slice(0, 3).map((collaborator, index) => (
                    <Avatar
                        key={collaborator.id}
                        className="h-7 w-7 border-2 border-[#1a1b1e] hover:z-10 transition-all cursor-pointer"
                        title={collaborator.name}
                    >
                        <AvatarImage src={collaborator.image} />
                        <AvatarFallback className="text-[10px] bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                            {getInitials(collaborator.name)}
                        </AvatarFallback>
                    </Avatar>
                ))}
                {displayCollaborators.length > 3 && (
                    <div className="h-7 w-7 rounded-full border-2 border-[#1a1b1e] bg-[#2c2d31] flex items-center justify-center text-[10px] font-medium text-[#d1d2d5]">
                        +{displayCollaborators.length - 3}
                    </div>
                )}
            </div>

            {/* Share Button */}
            <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-[#d1d2d5] hover:bg-[#2c2d31] hover:text-white"
                onClick={handleShareClick}
                title="Share project"
            >
                <Share2 className="h-4 w-4 mr-1.5" />
                <span className="text-sm font-medium">Share</span>
            </Button>

            {/* Favorite Toggle */}
            <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-[#2c2d31]"
                onClick={handleFavoriteClick}
                title={favorite ? "Remove from favorites" : "Add to favorites"}
            >
                <Star
                    className={cn(
                        "h-4 w-4 transition-colors",
                        favorite
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-[#7b7c7e] hover:text-yellow-400"
                    )}
                />
            </Button>

            {/* Options Menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-[#2c2d31]"
                        title="More options"
                    >
                        <MoreHorizontal className="h-4 w-4 text-[#d1d2d5]" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem>
                        <span>Duplicate project</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <span>Export data</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                        <span>Project settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">
                        <span>Delete project</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
