Stripe Quick Setup Guide

This guide explains how to set up and test Stripe subscriptions in the Node project.

1. Create a Stripe Account

Sign up at https://dashboard.stripe.com/register

Make sure Test mode is enabled (top-left toggle)

Test mode allows you to simulate payments without real charges.

2. Get API Keys

Go to https://dashboard.stripe.com/test/apikeys

Copy:

Secret key (sk_test_...)

Publishable key (pk_test_...)

Add them to .env.local:

STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

3. Create a Product & Recurring Price

Go to https://dashboard.stripe.com/test/products

Click Add product

Name: Pro Plan

Description: Unlimited nodes

In Pricing:

Pricing model: Standard

Billing: Recurring (Monthly or Yearly) ⚠️ required

Save and copy the Price ID (price_...)

Add to .env.local:

STRIPE_PRICE_ID="price_..."


The app also supports passing a Product ID (prod_...).
If provided, the backend automatically resolves its default recurring price.

4. Environment Variables (Summary)

Minimal required setup:

# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/node_db?schema=public"

# Auth
AUTH_SECRET="your-secret"
AUTH_URL="http://localhost:3000"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_PRICE_ID="price_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

5. Local Webhooks (Stripe CLI)

Stripe webhooks are required to update subscription status.

Install Stripe CLI

Windows (winget):

winget install stripe


macOS:

brew install stripe/stripe-cli/stripe

Login & Start Webhook Forwarding
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe


Copy the displayed whsec_... value and add it to .env.local.

Keep this terminal running during development.

6. Run the App Locally
# Apply DB schema
npm run db:push:local

# Start Next.js
npm run dev:local


Open http://localhost:3000

7. Test the Subscription Flow
Node Limit

Create nodes up to 20 → allowed

Create the 21st node → blocked with upgrade prompt

Checkout

Click Upgrade to Pro

Complete Stripe Checkout using test card:

4242 4242 4242 4242
12/34
123


After success:

Billing page shows Pro

Node limit is removed

Webhook Verification

Stripe CLI should log:

checkout.session.completed → 200

8. Production Notes

For production:

Disable Test mode

Create Live products & prices

Set environment variables on your hosting platform (e.g. Vercel)

Register a production webhook endpoint:

https://your-domain.com/api/webhooks/stripe

Troubleshooting

“Stripe price ID not configured”

STRIPE_PRICE_ID missing or empty → restart server

“Price must be recurring”

Product price is set to one-time → recreate as recurring

Webhook not firing

stripe listen not running

Wrong STRIPE_WEBHOOK_SECRET

Prisma type errors

npm run db:generate
