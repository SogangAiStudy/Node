"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface BillingPageClientProps {
    orgId: string;
    isOrgPro: boolean;
    nodeCount: number;
    stripeCustomerId: string | null;
}

export default function BillingPageClient({
    orgId,
    isOrgPro,
    nodeCount = 0,
    stripeCustomerId,
}: BillingPageClientProps) {
    const [loading, setLoading] = useState(false);
    const NODE_LIMIT = 20;

    const handleUpgrade = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orgId }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to create checkout session");
            }

            if (data.url) {
                window.location.href = data.url;
            }
        } catch (error) {
            console.error("Checkout error:", error);
            toast.error(error instanceof Error ? error.message : "Failed to start checkout");
            setLoading(false);
        }
    };

    const handleManageBilling = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/stripe/portal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orgId }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to create portal session");
            }

            if (data.url) {
                window.location.href = data.url;
            }
        } catch (error) {
            console.error("Portal error:", error);
            toast.error(error instanceof Error ? error.message : "Failed to open billing portal");
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Billing</h1>
                <p className="text-muted-foreground mt-2">
                    Manage your organization's subscription and billing
                </p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Current Plan</CardTitle>
                            <CardDescription>
                                You are currently on the {isOrgPro ? "Pro" : "Free"} plan
                            </CardDescription>
                        </div>
                        <Badge variant={isOrgPro ? "default" : "secondary"} className="ml-auto">
                            {isOrgPro ? "Pro" : "Free"}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Node Usage</span>
                            <span className="text-sm text-muted-foreground">
                                {nodeCount} / {isOrgPro ? "Unlimited" : NODE_LIMIT}
                            </span>
                        </div>
                        <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all ${isOrgPro
                                    ? "bg-green-500"
                                    : nodeCount >= NODE_LIMIT
                                        ? "bg-red-500"
                                        : nodeCount >= NODE_LIMIT * 0.8
                                            ? "bg-yellow-500"
                                            : "bg-blue-500"
                                    }`}
                                style={{
                                    width: isOrgPro ? "100%" : `${Math.min((nodeCount / NODE_LIMIT) * 100, 100)}%`,
                                }}
                            />
                        </div>
                    </div>

                    {!isOrgPro && nodeCount >= NODE_LIMIT && (
                        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                            <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                ⚠️ You've reached your limit
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                Upgrade to Pro to create unlimited nodes and continue growing your projects.
                            </p>
                        </div>
                    )}

                    {!isOrgPro && nodeCount < NODE_LIMIT && nodeCount >= NODE_LIMIT * 0.8 && (
                        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                You're approaching the limit
                            </p>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                You have {NODE_LIMIT - nodeCount} nodes remaining. Consider upgrading to Pro for
                                unlimited nodes.
                            </p>
                        </div>
                    )}

                    <div className="pt-4 ">
                        {isOrgPro ? (
                            <>
                                {stripeCustomerId && (
                                    <Button onClick={handleManageBilling} disabled={loading} size="lg">
                                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        <CreditCard className="mr-2 h-4 w-4" />
                                        Manage Billing
                                    </Button>
                                )}
                            </>
                        ) : (
                            <Button onClick={handleUpgrade} disabled={loading} size="lg" className="w-full sm:w-auto">
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Upgrade to Pro
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {!isOrgPro && (
                <Card>
                    <CardHeader>
                        <CardTitle>Pro Plan Benefits</CardTitle>
                        <CardDescription>Unlock the full potential of your organization</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2">
                            <li className="flex items-start">
                                <span className="text-green-500 mr-2">✓</span>
                                <span className="text-sm">Unlimited nodes across all projects</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-green-500 mr-2">✓</span>
                                <span className="text-sm">Priority support</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-green-500 mr-2">✓</span>
                                <span className="text-sm">Advanced analytics (coming soon)</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
