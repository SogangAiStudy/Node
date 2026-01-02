"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface LimitReachedDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgId: string;
    currentCount?: number;
    limit?: number;
}

export function LimitReachedDialog({
    open,
    onOpenChange,
    orgId,
    currentCount = 20,
    limit = 20,
}: LimitReachedDialogProps) {
    const router = useRouter();

    const handleUpgrade = () => {
        onOpenChange(false);
        router.push(`/org/${orgId}/billing`);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        🚫 Node limit reached
                    </DialogTitle>
                    <DialogDescription className="pt-4 space-y-3">
                        <p className="text-base text-foreground">
                            You've reached the <strong>20-node limit</strong> for the Free plan.
                        </p>
                        <p className="text-sm">
                            Upgrade to Pro to create unlimited nodes and keep building your graph.
                        </p>

                        <div className="pt-2">
                            <div className="flex items-center justify-between mb-2 text-sm">
                                <span className="font-medium">Node Usage</span>
                                <span className="text-muted-foreground">{currentCount} / {limit}</span>
                            </div>
                            <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 w-full" />
                            </div>
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-row gap-2 sm:gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpgrade}
                        className="flex-1"
                    >
                        Upgrade to Pro
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
