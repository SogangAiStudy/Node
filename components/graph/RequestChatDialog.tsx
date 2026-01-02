"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
    id: string;
    senderId: string;
    senderName: string;
    senderImage?: string;
    content: string;
    createdAt: Date;
}

interface RequestChatDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    requestId: string;
    requestQuestion: string;
    nodeTitle: string;
    currentUserId?: string;
}

export function RequestChatDialog({
    open,
    onOpenChange,
    requestId,
    requestQuestion,
    nodeTitle,
    currentUserId = "current-user",
}: RequestChatDialogProps) {
    const [messages, setMessages] = useState<Message[]>([
        // Mock initial messages
        {
            id: "1",
            senderId: "other-user",
            senderName: "Team Member",
            content: requestQuestion,
            createdAt: new Date(Date.now() - 3600000),
        },
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isSending, setIsSending] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages]);

    const handleSend = async () => {
        if (!inputValue.trim() || isSending) return;

        setIsSending(true);
        try {
            // Create new message
            const newMessage: Message = {
                id: Date.now().toString(),
                senderId: currentUserId,
                senderName: "You",
                content: inputValue.trim(),
                createdAt: new Date(),
            };

            setMessages((prev) => [...prev, newMessage]);
            setInputValue("");

            // TODO: Send to backend API
            // await fetch(`/api/requests/${requestId}/messages`, {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify({ content: newMessage.content }),
            // });
        } catch (error) {
            console.error("Failed to send message:", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const formatTime = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle className="text-base">
                        Request on <span className="font-mono text-sm">{nodeTitle}</span>
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">{requestQuestion}</p>
                </DialogHeader>

                {/* Messages List */}
                <ScrollArea className="flex-1 px-6" ref={scrollAreaRef}>
                    <div className="space-y-4 py-4">
                        {messages.map((message) => {
                            const isCurrentUser = message.senderId === currentUserId;

                            return (
                                <div
                                    key={message.id}
                                    className={cn(
                                        "flex gap-3",
                                        isCurrentUser ? "flex-row-reverse" : "flex-row"
                                    )}
                                >
                                    {/* Avatar */}
                                    <Avatar className="h-8 w-8 shrink-0">
                                        <AvatarImage src={message.senderImage} />
                                        <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                                            {getInitials(message.senderName)}
                                        </AvatarFallback>
                                    </Avatar>

                                    {/* Message Content */}
                                    <div
                                        className={cn(
                                            "flex flex-col gap-1 max-w-[70%]",
                                            isCurrentUser ? "items-end" : "items-start"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="font-medium">{message.senderName}</span>
                                            <span className="text-muted-foreground">
                                                {formatTime(message.createdAt)}
                                            </span>
                                        </div>
                                        <div
                                            className={cn(
                                                "px-3 py-2 rounded-lg text-sm",
                                                isCurrentUser
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted"
                                            )}
                                        >
                                            {message.content}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="px-6 py-4 border-t bg-muted/30">
                    <div className="flex gap-2">
                        <Textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type your message... (Shift+Enter for new line)"
                            className="min-h-[60px] max-h-[120px] resize-none"
                            disabled={isSending}
                        />
                        <Button
                            onClick={handleSend}
                            disabled={!inputValue.trim() || isSending}
                            size="icon"
                            className="h-[60px] w-[60px] shrink-0"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Press Enter to send, Shift+Enter for new line
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
