-- =============================================================================
-- MIGRATION: retell_call_events idempotency ledger + merge_retell_call_event RPC
-- =============================================================================
-- Purpose:
--   Adds a durable event ledger for Retell webhook deduplication and a merge
--   RPC that handles idempotent, out-of-order-safe, tenant-bound upserts into
--   retell_calls.
--
-- Properties:
--   - 100% idempotent (safe to run on fresh OR existing DBs)
--   - Adds 'analyzed' to retell_calls valid_status constraint
--   - Creates retell_call_events table with unique(org, call, event_type)
--   - RLS: service_role bypasses; org members can SELECT
--   - merge_retell_call_event RPC: single atomic operation for webhook processing
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend retell_calls valid_status to include 'analyzed'
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.retell_calls DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE public.retell_calls ADD CONSTRAINT valid_status
  CHECK (status IN ('started', 'ongoing', 'completed', 'failed', 'canceled', 'analyzed'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Create retell_call_events idempotency ledger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.retell_call_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  call_id text NOT NULL,
  event_type text NOT NULL,
  payload_hash text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  -- payload stored for debugging; never logged to stdout
  payload jsonb,

  -- Idempotency: one event_type per call per org
  CONSTRAINT uq_retell_call_event UNIQUE (organization_id, call_id, event_type)
);

-- Indexes for lookup performance
CREATE INDEX IF NOT EXISTS idx_retell_call_events_org_id
  ON public.retell_call_events (organization_id);
CREATE INDEX IF NOT EXISTS idx_retell_call_events_call_id
  ON public.retell_call_events (call_id);
CREATE INDEX IF NOT EXISTS idx_retell_call_events_received_at
  ON public.retell_call_events (received_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS for retell_call_events
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.retell_call_events ENABLE ROW LEVEL SECURITY;

-- service_role bypasses RLS automatically; these policies are for authenticated users
DROP POLICY IF EXISTS "retell_call_events_org_select" ON public.retell_call_events;
CREATE POLICY "retell_call_events_org_select"
  ON public.retell_call_events
  FOR SELECT
  USING (public.is_org_member(organization_id));

-- No insert/update/delete policies for authenticated users
-- Only service_role (webhook) can write; it bypasses RLS
DROP POLICY IF EXISTS "retell_call_events_deny_anon" ON public.retell_call_events;
CREATE POLICY "retell_call_events_deny_anon"
  ON public.retell_call_events
  FOR ALL
  TO anon
  USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. merge_retell_call_event RPC — idempotent, out-of-order-safe, tenant-bound
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.merge_retell_call_event(
  p_org_id uuid,
  p_call_id text,
  p_agent_id text,
  p_event_type text,
  p_payload jsonb,
  p_payload_hash text,
  p_received_at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
DECLARE
  v_inserted boolean;
  v_new_status text;
  v_new_status_rank int;
  v_existing_org_id uuid;
  -- Fields extracted from payload
  v_direction text;
  v_to_e164 text;
  v_from_e164 text;
  v_started_at timestamptz;
  v_ended_at timestamptz;
  v_duration_ms int;
  v_recording_url text;
  v_transcript_summary text;
  v_analysis_json jsonb;
  v_outcome text;
  v_sentiment text;
  v_lead_score int;
  v_topics text[];
BEGIN
  -- ─── Step 1: Insert into event ledger (idempotency check) ───────────────
  INSERT INTO public.retell_call_events (
    organization_id, call_id, event_type, payload_hash, received_at, payload
  ) VALUES (
    p_org_id, p_call_id, p_event_type, p_payload_hash, p_received_at, p_payload
  )
  ON CONFLICT ON CONSTRAINT uq_retell_call_event DO NOTHING;

  -- If no row was inserted, this is a duplicate → return false
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- ─── Step 2: Tenant-binding guard ──────────────────────────────────────
  -- If the call already exists, verify org_id matches (immutable)
  SELECT organization_id INTO v_existing_org_id
  FROM public.retell_calls
  WHERE call_id = p_call_id;

  IF v_existing_org_id IS NOT NULL AND v_existing_org_id != p_org_id THEN
    RAISE EXCEPTION 'Tenant binding violation: call % already belongs to org %, cannot reassign to %',
      p_call_id, v_existing_org_id, p_org_id;
  END IF;

  -- ─── Step 3: Determine new status + rank ────────────────────────────────
  v_new_status := CASE p_event_type
    WHEN 'call_started' THEN 'started'
    WHEN 'call_ended' THEN 'completed'
    WHEN 'call_analyzed' THEN 'analyzed'
    WHEN 'analysis_completed' THEN 'analyzed'
    ELSE 'started'  -- unknown events default to started
  END;

  v_new_status_rank := CASE v_new_status
    WHEN 'started' THEN 1
    WHEN 'ongoing' THEN 2
    WHEN 'completed' THEN 3
    WHEN 'analyzed' THEN 4
    ELSE 0
  END;

  -- ─── Step 4: Extract fields from payload ────────────────────────────────
  v_direction := COALESCE(p_payload->>'direction', 'inbound');
  -- Ensure E.164 format or use placeholder that satisfies constraint
  v_to_e164 := COALESCE(
    NULLIF(p_payload->>'to_number', ''),
    '+10000000000'
  );
  v_from_e164 := COALESCE(
    NULLIF(p_payload->>'from_number', ''),
    '+10000000000'
  );

  -- Timestamps
  IF p_payload->>'start_timestamp' IS NOT NULL THEN
    v_started_at := to_timestamp((p_payload->>'start_timestamp')::bigint);
  END IF;
  IF p_payload->>'end_timestamp' IS NOT NULL THEN
    v_ended_at := to_timestamp((p_payload->>'end_timestamp')::bigint);
  END IF;
  IF p_payload->>'call_length' IS NOT NULL THEN
    v_duration_ms := ((p_payload->>'call_length')::numeric * 1000)::int;
  END IF;

  v_recording_url := p_payload->>'recording_url';
  v_transcript_summary := p_payload->>'transcript_summary';

  -- Analysis fields (only from call_analyzed/analysis_completed)
  IF p_event_type IN ('call_analyzed', 'analysis_completed') AND p_payload->'call_analysis' IS NOT NULL THEN
    v_analysis_json := p_payload->'call_analysis';

    -- Extract outcome
    IF (v_analysis_json->>'call_successful') IS NOT NULL THEN
      v_outcome := CASE WHEN (v_analysis_json->>'call_successful')::boolean
        THEN 'positive' ELSE 'negative' END;
    END IF;

    -- Extract sentiment
    IF (v_analysis_json->>'user_sentiment') IS NOT NULL THEN
      v_sentiment := lower(v_analysis_json->>'user_sentiment');
      -- Validate against constraint
      IF v_sentiment NOT IN ('positive', 'negative', 'neutral', 'mixed') THEN
        v_sentiment := NULL;
      END IF;
    END IF;

    -- Compute lead score
    v_lead_score := 50;
    IF v_outcome = 'positive' THEN v_lead_score := v_lead_score + 30;
    ELSIF v_outcome = 'negative' THEN v_lead_score := v_lead_score - 30;
    END IF;
    IF v_sentiment = 'positive' THEN v_lead_score := v_lead_score + 20;
    ELSIF v_sentiment = 'negative' THEN v_lead_score := v_lead_score - 20;
    END IF;
    v_lead_score := GREATEST(0, LEAST(100, v_lead_score));
  END IF;

  -- ─── Step 5: Upsert into retell_calls (out-of-order safe) ──────────────
  INSERT INTO public.retell_calls (
    call_id,
    organization_id,
    agent_id,
    direction,
    to_e164,
    from_e164,
    status,
    started_at,
    ended_at,
    duration_ms,
    recording_signed_url,
    transcript_summary,
    analysis_json,
    outcome,
    sentiment,
    lead_score,
    raw_webhook_data
  ) VALUES (
    p_call_id,
    p_org_id,
    p_agent_id,
    v_direction,
    v_to_e164,
    v_from_e164,
    v_new_status,
    COALESCE(v_started_at, CASE WHEN p_event_type = 'call_started' THEN p_received_at ELSE NULL END),
    v_ended_at,
    v_duration_ms,
    v_recording_url,
    v_transcript_summary,
    v_analysis_json,
    v_outcome,
    v_sentiment,
    v_lead_score,
    p_payload
  )
  ON CONFLICT (call_id) DO UPDATE SET
    -- NEVER change organization_id (immutable tenant binding)
    -- agent_id: keep first non-null
    agent_id          = COALESCE(retell_calls.agent_id, EXCLUDED.agent_id),
    -- direction: keep first non-null (usually from call_started)
    direction         = COALESCE(retell_calls.direction, EXCLUDED.direction),
    -- Phone numbers: prefer non-placeholder values
    to_e164           = CASE
                          WHEN retell_calls.to_e164 = '+10000000000' AND EXCLUDED.to_e164 != '+10000000000'
                          THEN EXCLUDED.to_e164
                          ELSE retell_calls.to_e164
                        END,
    from_e164         = CASE
                          WHEN retell_calls.from_e164 = '+10000000000' AND EXCLUDED.from_e164 != '+10000000000'
                          THEN EXCLUDED.from_e164
                          ELSE retell_calls.from_e164
                        END,
    -- Status: NEVER regress (only advance based on rank)
    status            = CASE
                          WHEN (CASE retell_calls.status
                                  WHEN 'started' THEN 1
                                  WHEN 'ongoing' THEN 2
                                  WHEN 'completed' THEN 3
                                  WHEN 'analyzed' THEN 4
                                  ELSE 0
                                END) >= v_new_status_rank
                          THEN retell_calls.status
                          ELSE EXCLUDED.status
                        END,
    -- Timestamps: use earliest started_at, latest ended_at
    started_at        = COALESCE(
                          LEAST(retell_calls.started_at, EXCLUDED.started_at),
                          retell_calls.started_at,
                          EXCLUDED.started_at
                        ),
    ended_at          = COALESCE(
                          GREATEST(retell_calls.ended_at, EXCLUDED.ended_at),
                          retell_calls.ended_at,
                          EXCLUDED.ended_at
                        ),
    -- Duration: prefer latest non-null value
    duration_ms       = COALESCE(EXCLUDED.duration_ms, retell_calls.duration_ms),
    -- Recording/transcript: prefer latest non-null
    recording_signed_url = COALESCE(EXCLUDED.recording_signed_url, retell_calls.recording_signed_url),
    transcript_summary   = COALESCE(EXCLUDED.transcript_summary, retell_calls.transcript_summary),
    -- Analysis: only set from analyzed events
    analysis_json     = COALESCE(EXCLUDED.analysis_json, retell_calls.analysis_json),
    outcome           = COALESCE(EXCLUDED.outcome, retell_calls.outcome),
    sentiment         = COALESCE(EXCLUDED.sentiment, retell_calls.sentiment),
    lead_score        = COALESCE(EXCLUDED.lead_score, retell_calls.lead_score),
    -- raw_webhook_data: always store latest payload
    raw_webhook_data  = EXCLUDED.raw_webhook_data
  WHERE retell_calls.call_id = p_call_id;

  RETURN true;
END;
$fn$;

-- Grant execute to service_role (webhook) and authenticated (future RPC calls)
GRANT EXECUTE ON FUNCTION public.merge_retell_call_event(uuid, text, text, text, jsonb, text, timestamptz)
  TO service_role, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Verification block
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_table_exists boolean;
  v_fn_exists boolean;
  v_policy_count int;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'retell_call_events')
    INTO v_table_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'merge_retell_call_event'
  ) INTO v_fn_exists;

  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'retell_call_events';

  RAISE NOTICE '✅ retell_call_events migration complete:';
  RAISE NOTICE '   Table exists: %', v_table_exists;
  RAISE NOTICE '   merge_retell_call_event function exists: %', v_fn_exists;
  RAISE NOTICE '   RLS policies on retell_call_events: %', v_policy_count;

  IF NOT v_table_exists OR NOT v_fn_exists THEN
    RAISE EXCEPTION 'Migration verification failed: table=% fn=%', v_table_exists, v_fn_exists;
  END IF;
END$$;
