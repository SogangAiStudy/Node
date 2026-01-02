"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Layers } from "lucide-react";

interface SubjectCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (name: string) => void;
}

export function SubjectCreationModal({
    isOpen,
    onClose,
    onCreated,
}: SubjectCreationModalProps) {
    const [name, setName] = useState("");

    const handleCreate = () => {
        if (name.trim()) {
            onCreated(name.trim());
            setName("");
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] bg-[#1a1b1e] border-[#2c2d31] text-[#d1d2d5]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                        <Layers className="h-5 w-5 text-blue-400" />
                        Create New Subject
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="text-sm font-medium text-[#7b7c7e]">
                            Subject Name
                        </Label>
                        <Input
                            id="name"
                            placeholder="e.g. Engineering, Marketing, Design"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-[#2c2d31] border-[#2c2d31] text-white focus:border-[#3b3c40]"
                            autoFocus
                        />
                        <p className="text-[11px] text-[#7b7c7e]">
                            Subjects act as visual dividers in your workspace to help organize projects.
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="text-[#7b7c7e] hover:bg-[#2c2d31] hover:text-white"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreate}
                        disabled={!name.trim()}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        Create Subject
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
