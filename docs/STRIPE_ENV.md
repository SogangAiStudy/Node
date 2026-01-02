# Stripe Environment Variables

This file documents the required Stripe environment variables for the payment integration.

## Required Variables

Add these to your `.env.local` file for local development:

```bash
# Stripe Keys (from Stripe Dashboard)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Product Price ID (from Stripe Dashboard > Products)
STRIPE_PRICE_ID=price_...
```

## How to Get These Values

### 1. STRIPE_SECRET_KEY
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Copy the **Secret key** (starts with `sk_test_` for test mode)

### 2. STRIPE_PUBLISHABLE_KEY
1. Same page as above
2. Copy the **Publishable key** (starts with `pk_test_` for test mode)

### 3. STRIPE_PRICE_ID
1. Go to [Stripe Dashboard > Products](https://dashboard.stripe.com/test/products)
2. Create a new product (e.g., "Pro Plan")
3. Add a recurring price (e.g., $10/month)
4. Copy the **Price ID** (starts with `price_`)

### 4. STRIPE_WEBHOOK_SECRET
1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "Add endpoint"
3. Set endpoint URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Signing secret** (starts with `whsec_`)

## Testing Locally with Stripe CLI

For local development, use the Stripe CLI to forward webhooks:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

This will give you a webhook secret that starts with `whsec_`. Use this as `STRIPE_WEBHOOK_SECRET` in your `.env.local`.

## Deployment (Vercel)

1. Add all environment variables to Vercel:
   - Go to Project Settings > Environment Variables
   - Add each variable for Production, Preview, and Development
2. Update webhook endpoint in Stripe Dashboard to your production URL
3. Redeploy your application
