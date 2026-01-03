"use client";

import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Sparkles } from "lucide-react";
import { ActionCenter } from "@/components/action-center/ActionCenter";

export default function HomePage() {
    const params = useParams();
    const { data: session } = useSession();
    const orgId = params.orgId as string;

    const firstName = session?.user?.name?.split(" ")[0] || "there";

    // Get current hour for greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

    return (
        <div className="p-8 max-w-5xl mx-auto pb-20 space-y-8">
            {/* Header section with Greeting and Stats Summary (Placeholder for now as optional) */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center">
                        {greeting}, {firstName} <Sparkles className="inline h-6 w-6 text-yellow-400 ml-2 animate-pulse" />
                    </h1>
                    <p className="text-muted-foreground text-lg">Here is your action plan for today.</p>
                </div>
                {/* Optional Summary Strip could go here, e.g. "5 Actions", "3 Waiting" small count cards */}
            </div>

            {/* Global Action Center - Primary Section */}
            <section className="space-y-4">
                <ActionCenter orgId={orgId} />
            </section>
        </div>
    );
}
