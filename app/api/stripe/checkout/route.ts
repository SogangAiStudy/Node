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

        const { orgId } = await req.json();
        if (!orgId) {
            return NextResponse.json(
                { error: "Organization ID is required" },
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
            include: {
                owner: true,
            },
        });

        if (!org) {
            return NextResponse.json(
                { error: "Organization not found or access denied" },
                { status: 404 }
            );
        }

        const configuredPriceId = process.env.STRIPE_PRICE_ID;
        if (!configuredPriceId) {
            return NextResponse.json(
                { error: "Stripe price ID not configured" },
                { status: 500 }
            );
        }

        // Support both price IDs and product IDs with default recurring prices
        let priceId = configuredPriceId;
        if (configuredPriceId.startsWith("prod_")) {
            const product = await stripe.products.retrieve(configuredPriceId);
            const defaultPriceId =
                typeof product.default_price === "string"
                    ? product.default_price
                    : product.default_price?.id;

            if (!defaultPriceId) {
                return NextResponse.json(
                    { error: "Stripe product is missing a default recurring price" },
                    { status: 500 }
                );
            }

            priceId = defaultPriceId;
        }

        const price = await stripe.prices.retrieve(priceId);
        if (price.type !== "recurring") {
            return NextResponse.json(
                { error: "Stripe price must be a recurring price for subscriptions" },
                { status: 500 }
            );
        }

        // Create or retrieve Stripe customer
        let customerId = org.stripeCustomerId;

        // Validate that the customer exists in Stripe
        if (customerId) {
            try {
                await stripe.customers.retrieve(customerId);
            } catch (error: any) {
                // Customer doesn't exist in Stripe (likely environment mismatch)
                console.warn(`Customer ${customerId} not found in Stripe, creating new customer`);
                customerId = null;
            }
        }

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: org.owner.email || undefined,
                metadata: {
                    orgId: org.id,
                    orgName: org.name,
                },
            });

            customerId = customer.id;

            // Update organization with customer ID
            await prisma.organization.update({
                where: { id: org.id },
                data: { stripeCustomerId: customerId },
            });
        }

        // Create Checkout Session
        // Dynamically determine base URL from request headers or environment
        const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/");
        const baseUrl = process.env.NEXTAUTH_URL || origin || "http://localhost:3000";

        console.log("[Checkout] Using baseUrl:", baseUrl);

        const checkoutSession = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${baseUrl}/org/${orgId}/billing?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/org/${orgId}/billing?canceled=1`,
            metadata: {
                orgId: org.id,
            },
        });

        return NextResponse.json({ url: checkoutSession.url });
    } catch (error) {
        console.error("Checkout error:", error);
        return NextResponse.json(
            { error: "Failed to create checkout session" },
            { status: 500 }
        );
    }
}