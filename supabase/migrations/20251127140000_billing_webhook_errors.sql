-- ============================================================================
-- Migration: billing_webhook_errors
-- Purpose: Create table to log failed Stripe webhook events for monitoring
-- ============================================================================

-- Create billing_webhook_errors table to track failed webhook processing
CREATE TABLE IF NOT EXISTS public.billing_webhook_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT,                           -- Stripe event ID (evt_xxx)
  event_type TEXT,                         -- Stripe event type (e.g., customer.subscription.updated)
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  error_message TEXT NOT NULL,
  error_code TEXT,                         -- Internal error code (e.g., INVALID_SIGNATURE)
  raw_status INTEGER,                      -- HTTP status code returned
  raw_payload JSONB,                       -- Optional: raw payload for debugging (truncated)
  correlation_id TEXT,                     -- Request correlation ID
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add index for querying by event_id (for deduplication/lookup)
CREATE INDEX IF NOT EXISTS idx_billing_webhook_errors_event_id 
  ON public.billing_webhook_errors(event_id);

-- Add index for querying by organization
CREATE INDEX IF NOT EXISTS idx_billing_webhook_errors_org_id 
  ON public.billing_webhook_errors(organization_id);

-- Add index for querying recent errors
CREATE INDEX IF NOT EXISTS idx_billing_webhook_errors_created_at 
  ON public.billing_webhook_errors(created_at DESC);

-- Add index for querying by event_type
CREATE INDEX IF NOT EXISTS idx_billing_webhook_errors_event_type 
  ON public.billing_webhook_errors(event_type);

-- Enable RLS (service role will bypass, but table is protected)
ALTER TABLE public.billing_webhook_errors ENABLE ROW LEVEL SECURITY;

-- Only superadmins can read webhook errors (via service role in dashboard)
CREATE POLICY "superadmins_can_view_webhook_errors"
  ON public.billing_webhook_errors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  );

-- Service role (edge functions) can insert errors
-- No policy needed - service role bypasses RLS

-- Add comment for documentation
COMMENT ON TABLE public.billing_webhook_errors IS 
  'Logs failed Stripe webhook events for monitoring and alerting. TODO: Hook into email/Slack alerts.';

COMMENT ON COLUMN public.billing_webhook_errors.event_id IS 
  'Stripe event ID (evt_xxx) if available';

COMMENT ON COLUMN public.billing_webhook_errors.event_type IS 
  'Stripe event type (e.g., customer.subscription.updated)';

COMMENT ON COLUMN public.billing_webhook_errors.raw_payload IS 
  'Truncated raw payload for debugging - do not store sensitive data';
