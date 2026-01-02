import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db/prisma";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
        return NextResponse.json(
            { error: "No signature found" },
            { status: 400 }
        );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error("STRIPE_WEBHOOK_SECRET is not configured");
        return NextResponse.json(
            { error: "Webhook secret not configured" },
            { status: 500 }
        );
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return NextResponse.json(
            { error: "Invalid signature" },
            { status: 400 }
        );
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                const orgId = session.metadata?.orgId;

                if (!orgId) {
                    console.error("No orgId in checkout session metadata");
                    break;
                }

                // Get subscription details
                const subscriptionId = session.subscription as string;
                if (!subscriptionId) {
                    console.error("No subscription ID in checkout session");
                    break;
                }

                const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;

                await prisma.organization.update({
                    where: { id: orgId },
                    data: {
                        stripeCustomerId: session.customer as string,
                        stripeSubscriptionId: subscription.id,
                        stripePriceId: subscription.items?.data?.[0]?.price?.id,
                        stripeSubscriptionStatus: subscription.status,
                        stripeCurrentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
                    },
                });

                console.log(`Subscription created for org ${orgId}`);
                break;
            }

            case "customer.subscription.updated": {
                const subscription = event.data.object as any;
                const customerId = subscription.customer as string;

                const org = await prisma.organization.findUnique({
                    where: { stripeCustomerId: customerId },
                });

                if (!org) {
                    console.error(`No organization found for customer ${customerId}`);
                    break;
                }

                await prisma.organization.update({
                    where: { id: org.id },
                    data: {
                        stripeSubscriptionId: subscription.id,
                        stripePriceId: subscription.items?.data?.[0]?.price?.id,
                        stripeSubscriptionStatus: subscription.status,
                        stripeCurrentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
                    },
                });

                console.log(`Subscription updated for org ${org.id}`);
                break;
            }

            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                const org = await prisma.organization.findUnique({
                    where: { stripeCustomerId: customerId },
                });

                if (!org) {
                    console.error(`No organization found for customer ${customerId}`);
                    break;
                }

                await prisma.organization.update({
                    where: { id: org.id },
                    data: {
                        stripeSubscriptionId: null,
                        stripePriceId: null,
                        stripeSubscriptionStatus: "canceled",
                        stripeCurrentPeriodEnd: null,
                    },
                });

                console.log(`Subscription deleted for org ${org.id}`);
                break;
            }

            case "invoice.payment_succeeded": {
                const invoice = event.data.object as any;
                const subscriptionId = invoice.subscription as string;

                if (!subscriptionId) break;

                const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
                const customerId = subscription.customer as string;

                const org = await prisma.organization.findUnique({
                    where: { stripeCustomerId: customerId },
                });

                if (!org) {
                    console.error(`No organization found for customer ${customerId}`);
                    break;
                }

                await prisma.organization.update({
                    where: { id: org.id },
                    data: {
                        stripeSubscriptionStatus: subscription.status,
                        stripeCurrentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
                    },
                });

                console.log(`Payment succeeded for org ${org.id}`);
                break;
            }

            case "invoice.payment_failed": {
                const invoice = event.data.object as any;
                const subscriptionId = invoice.subscription as string;

                if (!subscriptionId) break;

                const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
                const customerId = subscription.customer as string;

                const org = await prisma.organization.findUnique({
                    where: { stripeCustomerId: customerId },
                });

                if (!org) {
                    console.error(`No organization found for customer ${customerId}`);
                    break;
                }

                await prisma.organization.update({
                    where: { id: org.id },
                    data: {
                        stripeSubscriptionStatus: subscription.status,
                    },
                });

                console.log(`Payment failed for org ${org.id}`);
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("Webhook handler error:", error);
        return NextResponse.json(
            { error: "Webhook handler failed" },
            { status: 500 }
        );
    }
}
