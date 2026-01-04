import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
    try {
        if (!stripe) {
            return NextResponse.json(
                { error: "Stripe is not configured" },
                { status: 503 }
            );
        }

        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId, orgId } = await req.json();
        if (!sessionId || !orgId) {
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
            return NextResponse.json(
                { error: "Organization not found or access denied" },
                { status: 404 }
            );
        }

        // Retrieve the checkout session from Stripe
        const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

        if (checkoutSession.payment_status !== "paid") {
            return NextResponse.json(
                { error: "Payment not completed" },
                { status: 400 }
            );
        }

        // Get subscription details
        const subscriptionId = checkoutSession.subscription as string;
        if (!subscriptionId) {
            return NextResponse.json(
                { error: "No subscription found in session" },
                { status: 400 }
            );
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;

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

        console.log(`Subscription verified and updated for org ${orgId}`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Verify session error:", error);
        return NextResponse.json(
            { error: "Failed to verify session" },
            { status: 500 }
        );
    }
}
