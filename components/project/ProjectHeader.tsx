"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Star, Share2, MoreHorizontal, Users } from "lucide-react";
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
import { ShareDialog } from "./ShareDialog";

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
}

export function ProjectHeader({
    projectId,
    projectName,
    orgId,
    collaborators = [],
    isFavorite = false,
    onFavoriteToggle,
}: ProjectHeaderProps) {
    const router = useRouter();
    const params = useParams();
    const [favorite, setFavorite] = useState(isFavorite);
    const [shareOpen, setShareOpen] = useState(false);

    const handleFavoriteClick = () => {
        const newState = !favorite;
        setFavorite(newState);
        onFavoriteToggle?.(newState);
        // TODO: Persist to backend
    };

    const handleShareClick = () => {
        setShareOpen(true);
    };

    const handleMemberManagement = () => {
        const currentOrgId = params.orgId as string;
        router.push(`/org/${currentOrgId}/projects/${projectId}/members`);
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
        <>
            <div className="sticky top-0 z-50 flex items-center justify-end gap-2 px-6 py-2 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/95">
                {/* Collaborators */}
                <div className="flex items-center -space-x-2">
                    {displayCollaborators.slice(0, 3).map((collaborator, index) => (
                        <Avatar
                            key={collaborator.id}
                            className="h-7 w-7 border-2 border-white hover:z-10 transition-all cursor-pointer"
                            title={collaborator.name}
                        >
                            <AvatarImage src={collaborator.image} />
                            <AvatarFallback className="text-[10px] bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                                {getInitials(collaborator.name)}
                            </AvatarFallback>
                        </Avatar>
                    ))}
                    {displayCollaborators.length > 3 && (
                        <div className="h-7 w-7 rounded-full border-2 border-white bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                            +{displayCollaborators.length - 3}
                        </div>
                    )}
                </div>

                {/* Share Button */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 hover:bg-accent"
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
                    className="h-8 w-8 p-0 hover:bg-accent"
                    onClick={handleFavoriteClick}
                    title={favorite ? "Remove from favorites" : "Add to favorites"}
                >
                    <Star
                        className={cn(
                            "h-4 w-4 transition-colors",
                            favorite
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground hover:text-yellow-400"
                        )}
                    />
                </Button>

                {/* Options Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-accent"
                            title="More options"
                        >
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={handleMemberManagement}>
                            <Users className="h-4 w-4 mr-2" />
                            <span>Manage members</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
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

            {/* Simple Share Dialog for quick invites */}
            <ShareDialog
                open={shareOpen}
                onOpenChange={setShareOpen}
                projectId={projectId}
                orgId={orgId}
            />

            {/* Full Member Management Modal */}
            <ShareModal
                open={memberManagementOpen}
                onOpenChange={setMemberManagementOpen}
                projectId={projectId}
                orgId={orgId}
            />
        </>
    );
}
