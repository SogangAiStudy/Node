"use client";

import { forwardRef } from "react";
import { Plus, Link2, Maximize } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ContextMenuPosition {
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
}

interface CanvasContextMenuProps {
    position: ContextMenuPosition;
    onClose: () => void;
    onAddNode: (x: number, y: number) => void;
}

export const CanvasContextMenu = forwardRef<HTMLDivElement, CanvasContextMenuProps>(
    ({ position, onClose, onAddNode }, ref) => {
        return (
            <div
                ref={ref}
                className="fixed bg-white rounded-lg border border-slate-200 shadow-xl py-1 min-w-[160px] z-50 animate-in fade-in-0 zoom-in-95"
                style={{
                    left: position.x,
                    top: position.y,
                }}
            >
                <button
                    onClick={() => {
                        onAddNode(position.canvasX, position.canvasY);
                        onClose();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                >
                    <Plus className="h-4 w-4 text-blue-500" />
                    <span>Add Node Here</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                    disabled
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                >
                    <Link2 className="h-4 w-4" />
                    <span>Connect Nodes</span>
                </button>
                <button
                    disabled
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                >
                    <Maximize className="h-4 w-4" />
                    <span>Fit View</span>
                </button>
            </div>
        );
    }
);

CanvasContextMenu.displayName = "CanvasContextMenu";
