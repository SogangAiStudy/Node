"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ShareModal } from "./ShareModal";

interface ShareButtonProps {
    projectId: string;
    orgId: string;
}

export function ShareButton({ projectId, orgId }: ShareButtonProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-[#1a1b1e] border-[#2c2d31] text-[#d1d2d5] hover:bg-[#2c2d31] hover:text-white"
                onClick={() => setOpen(true)}
            >
                <Share2 className="h-4 w-4" />
                Share
            </Button>
            <ShareModal
                open={open}
                onOpenChange={setOpen}
                projectId={projectId}
                orgId={orgId}
            />
        </>
    );
}
