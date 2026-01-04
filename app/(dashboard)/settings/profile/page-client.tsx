"use client";

import { useRouter } from "next/navigation";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserCircle, Mail, ShieldCheck, CreditCard, Crown, ArrowLeft } from "lucide-react";

interface ProfilePageClientProps {
    user: {
        name?: string | null;
        email?: string | null;
        image?: string | null;
    };
    organization: {
        id: string;
        name: string;
        stripeSubscriptionStatus: string | null;
        stripeCurrentPeriodEnd: Date | null;
    } | null;
}

export default function ProfilePageClient({ user, organization }: ProfilePageClientProps) {
    const router = useRouter();

    const initials = user.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "U";

    const isPro =
        organization?.stripeSubscriptionStatus === "active" ||
        organization?.stripeSubscriptionStatus === "trialing";

    const handleManageBilling = () => {
        if (organization) {
            router.push(`/org/${organization.id}/billing`);
        }
    };

    const handleBack = () => {
        if (organization) {
            router.push(`/org/${organization.id}/home`);
        } else {
            router.push("/");
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-12 px-6">
            <div className="mb-6">
                <Button variant="ghost" onClick={handleBack} className="gap-2 pl-0 hover:bg-transparent hover:text-primary">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                </Button>
            </div>

            <div className="mb-10 text-center">
                <Avatar className="h-24 w-24 mx-auto mb-4 border-4 border-white shadow-xl">
                    <AvatarImage src={user.image || undefined} />
                    <AvatarFallback className="text-2xl font-bold bg-[#f1f1ef] text-[#37352f]">
                        {initials}
                    </AvatarFallback>
                </Avatar>
                <h1 className="text-3xl font-bold text-[#1a1b1e] tracking-tight">{user.name}</h1>
                <p className="text-[#7b7c7e]">{user.email}</p>
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
                            <span className="text-sm text-[#1a1b1e]">{user.email}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-[#f1f1ef]">
                            <span className="text-sm font-medium text-[#7b7c7e] flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4" /> Account Status
                            </span>
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
                                Verified
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-sm font-medium text-[#7b7c7e] flex items-center gap-2">
                                <CreditCard className="h-4 w-4" /> Subscription
                            </span>
                            <div className="flex items-center gap-2">
                                {isPro ? (
                                    <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 border-none flex items-center gap-1">
                                        <Crown className="h-3 w-3" />
                                        Pro Plan
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary">Free Plan</Badge>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {organization && (
                    <Card className="border-[#e9e9e9] shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Billing & Subscription</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">
                                        {isPro ? "Pro Plan" : "Free Plan"}
                                    </p>
                                    <p className="text-xs text-[#7b7c7e]">
                                        {isPro
                                            ? "Unlimited nodes across all projects"
                                            : "Limited to 20 nodes per organization"}
                                    </p>
                                    {isPro && organization.stripeCurrentPeriodEnd && (
                                        <p className="text-xs text-[#7b7c7e]">
                                            Renews on{" "}
                                            {new Date(organization.stripeCurrentPeriodEnd).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <Button
                                onClick={handleManageBilling}
                                variant={isPro ? "outline" : "default"}
                                className="w-full"
                            >
                                {isPro ? "Manage Subscription" : "Upgrade to Pro"}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <p className="text-[12px] text-[#7b7c7e] text-center italic mt-4">
                    Full profile editing functionality coming soon.
                </p>
            </div>
        </div>
    );
}
