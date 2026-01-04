UPDATE "organizations"
SET "stripe_subscription_status" = 'active',
    "stripe_price_id" = 'price_manual_pro_fix',
    "stripe_current_period_end" = NOW() + INTERVAL '30 days'
FROM "users"
WHERE "organizations"."ownerId" = "users".id
AND "users".email = 'baebae286273@gmail.com';
