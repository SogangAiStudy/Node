import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
    console.log("[verify-session] Starting verification");

    try {
        if (!stripe) {
            console.error("[verify-session] Stripe not configured");
            return NextResponse.json(
                { error: "Stripe is not configured" },
                { status: 503 }
            );
        }

        const session = await auth();
        if (!session?.user?.id) {
            console.error("[verify-session] Unauthorized - no session");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        console.log("[verify-session] Request body:", body);

        const { sessionId, orgId } = body;
        if (!sessionId || !orgId) {
            console.error("[verify-session] Missing sessionId or orgId");
            return NextResponse.json(
                { error: "Session ID and Org ID are required" },
                { status: 400 }
            );
        }

        // Verify user is member of the organization
        const org = await prisma.organization.findFirst({
            where: {
                id: orgId,
                OR: [
                    { ownerId: session.user.id },
                    {
                        members: {
                            some: {
                                userId: session.user.id,
                            },
                        },
                    },
                ],
            },
        });

        if (!org) {
            console.error("[verify-session] Organization not found or access denied", { orgId, userId: session.user.id });
            return NextResponse.json(
                { error: "Organization not found or access denied" },
                { status: 404 }
            );
        }

        console.log("[verify-session] Retrieving checkout session from Stripe", sessionId);

        // Retrieve the checkout session from Stripe
        const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

        console.log("[verify-session] Checkout session retrieved", {
            payment_status: checkoutSession.payment_status,
            subscription: checkoutSession.subscription,
        });

        if (checkoutSession.payment_status !== "paid") {
            console.error("[verify-session] Payment not completed", checkoutSession.payment_status);
            return NextResponse.json(
                { error: "Payment not completed" },
                { status: 400 }
            );
        }

        // Get subscription details
        const subscriptionId = checkoutSession.subscription as string;
        if (!subscriptionId) {
            console.error("[verify-session] No subscription in session");
            return NextResponse.json(
                { error: "No subscription found in session" },
                { status: 400 }
            );
        }

        console.log("[verify-session] Retrieving subscription from Stripe", subscriptionId);

        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;

        console.log("[verify-session] Subscription retrieved", {
            status: subscription.status,
            current_period_end: subscription.current_period_end,
        });

        // Update organization with subscription details
        await prisma.organization.update({
            where: { id: orgId },
            data: {
                stripeCustomerId: checkoutSession.customer as string,
                stripeSubscriptionId: subscription.id,
                stripePriceId: subscription.items?.data?.[0]?.price?.id,
                stripeSubscriptionStatus: subscription.status,
                stripeCurrentPeriodEnd: subscription.current_period_end
                    ? new Date(subscription.current_period_end * 1000)
                    : null,
            },
        });

        console.log(`[verify-session] ✅ Subscription verified and updated for org ${orgId}`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[verify-session] ❌ Error:", error);
        return NextResponse.json(
            { error: "Failed to verify session" },
            { status: 500 }
        );
    }
}
