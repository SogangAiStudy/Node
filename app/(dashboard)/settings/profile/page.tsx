"use client";

import { useSession } from "next-auth/react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Mail, Calendar, ShieldCheck } from "lucide-react";

export default function ProfilePage() {
    const { data: session } = useSession();

    if (!session?.user) return null;

    const initials = session.user.name
        ?.split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase() || "U";

    return (
        <div className="max-w-2xl mx-auto py-12 px-6">
            <div className="mb-10 text-center">
                <Avatar className="h-24 w-24 mx-auto mb-4 border-4 border-white shadow-xl">
                    <AvatarImage src={session.user.image || undefined} />
                    <AvatarFallback className="text-2xl font-bold bg-[#f1f1ef] text-[#37352f]">
                        {initials}
                    </AvatarFallback>
                </Avatar>
                <h1 className="text-3xl font-bold text-[#1a1b1e] tracking-tight">{session.user.name}</h1>
                <p className="text-[#7b7c7e]">{session.user.email}</p>
            </div>

            <div className="grid gap-6">
                <Card className="border-[#e9e9e9] shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <UserCircle className="h-5 w-5 text-[#7b7c7e]" />
                            Profile Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-[#f1f1ef]">
                            <span className="text-sm font-medium text-[#7b7c7e] flex items-center gap-2">
                                <Mail className="h-4 w-4" /> Email Address
                            </span>
                            <span className="text-sm text-[#1a1b1e]">{session.user.email}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-[#f1f1ef]">
                            <span className="text-sm font-medium text-[#7b7c7e] flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4" /> Account Status
                            </span>
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Verified</Badge>
                        </div>
                    </CardContent>
                </Card>

                <p className="text-[12px] text-[#7b7c7e] text-center italic mt-4">
                    Full profile editing functionality coming soon.
                </p>
            </div>
        </div>
    );
}
