-- Ensure each organization can have at most one active or trialing subscription.
-- This prevents billing conflicts from multiple concurrent subscriptions.

CREATE UNIQUE INDEX IF NOT EXISTS org_stripe_subscriptions_one_active_per_org
ON public.org_stripe_subscriptions (organization_id)
WHERE status IN ('active', 'trialing');
