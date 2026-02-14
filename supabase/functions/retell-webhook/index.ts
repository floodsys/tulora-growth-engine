import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RETELL_WEBHOOK_SECRET } from '../_shared/env.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { verifyWebhookSignature } from '../_shared/retellSignature.ts'

// Declare EdgeRuntime for Supabase Edge Functions background tasks
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

interface RetellWebhookEvent {
  event: string
  call_id: string
  agent_id?: string
  call_type?: 'web_call' | 'phone_call'
  call_status?: 'ongoing' | 'completed' | 'error'
  direction?: 'inbound' | 'outbound'
  from_number?: string
  to_number?: string
  start_timestamp?: number
  end_timestamp?: number
  call_length?: number
  recording_url?: string
  transcript?: string
  transcript_summary?: string
  call_analysis?: {
    call_successful?: boolean
    call_summary?: string
    user_sentiment?: string
    agent_summary?: string
    inbound_phone_call_summary?: {
      evaluation?: {
        call_result?: string
        call_summary?: string
        extraction?: Record<string, any>
      }
    }
  }
  metadata?: Record<string, any>
}

/**
 * Compute SHA-256 hash of rawBody using Web Crypto API.
 * Returns hex-encoded hash string.
 */
async function computePayloadHash(rawBody: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(rawBody);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive organization_id from agent_id via retell_agents table lookup.
 * Returns null if agent not found (will cause 400 response).
 */
async function getOrganizationFromAgent(supabase: ReturnType<typeof createClient>, agentId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('retell_agents')
    .select('organization_id')
    .eq('agent_id', agentId)
    .single()

  if (error || !data) {
    console.error('[retell-webhook] agent lookup failed:', agentId?.substring(0, 8) + '…')
    return null
  }

  return data.organization_id
}

/**
 * Optional background enrichment work. Runs inside EdgeRuntime.waitUntil()
 * so it never blocks the fast-ack response.
 */
async function backgroundEnrichment(
  supabase: ReturnType<typeof createClient>,
  callId: string,
  eventType: string,
  orgId: string,
): Promise<void> {
  try {
    // Placeholder for future enrichment tasks:
    // - Fetch & store transcript from Retell API
    // - Download & archive recording to Supabase Storage
    // - Trigger CRM sync
    // - Send Slack/email notifications
    console.log(`[retell-webhook] background enrichment complete: event=${eventType} org=${orgId.substring(0, 8)}…`)
  } catch (err) {
    // Background errors must not propagate; log only type info
    console.error(`[retell-webhook] background enrichment error: event=${eventType}`, err instanceof Error ? err.message : 'unknown')
  }
}

serve(async (req) => {
  const startTime = Date.now();
  const corsHeaders = { ...getCorsHeaders(req), 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retell-signature' };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Generate correlation ID for structured logging
  const corrId = crypto.randomUUID().substring(0, 8);

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 1: Read raw body for signature verification ──────────────────
    const rawBody = await req.text();

    // ── Step 2: Verify webhook signature BEFORE any side effects ──────────
    const signature = req.headers.get('x-retell-signature');
    if (!signature) {
      console.error(`[retell-webhook][${corrId}] missing x-retell-signature header`);
      return new Response(
        JSON.stringify({ error: 'Missing webhook signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const webhookSecret = RETELL_WEBHOOK_SECRET();
    if (!webhookSecret) {
      console.error(`[retell-webhook][${corrId}] RETELL_WEBHOOK_SECRET not configured`);
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isValidSignature = await verifyWebhookSignature(signature, rawBody, webhookSecret);
    if (!isValidSignature) {
      console.error(`[retell-webhook][${corrId}] invalid webhook signature`);
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 3: Parse payload ONLY after signature verification ───────────
    const webhookBody: RetellWebhookEvent = JSON.parse(rawBody);
    const eventType = webhookBody.event;
    const callId = webhookBody.call_id;
    const agentId = webhookBody.agent_id;

    // Log only safe, non-sensitive fields
    console.log(`[retell-webhook][${corrId}] event=${eventType} call=${callId?.substring(0, 12)}…`);

    if (!callId) {
      console.error(`[retell-webhook][${corrId}] missing call_id in payload`);
      return new Response(
        JSON.stringify({ error: 'Missing call_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 4: Derive org_id from agent_id (tenant binding) ──────────────
    const supabase = createClient(SUPABASE_URL(), SUPABASE_SERVICE_ROLE_KEY());

    if (!agentId) {
      console.error(`[retell-webhook][${corrId}] missing agent_id — cannot derive org`);
      return new Response(
        JSON.stringify({ error: 'Missing agent_id — cannot determine tenant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = await getOrganizationFromAgent(supabase, agentId);
    if (!orgId) {
      console.error(`[retell-webhook][${corrId}] org_id is null for agent=${agentId.substring(0, 8)}…`);
      return new Response(
        JSON.stringify({ error: 'Could not determine organization for agent' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 5: Compute payload hash for idempotency ──────────────────────
    const payloadHash = await computePayloadHash(rawBody);

    // ── Step 6: Call merge RPC (single atomic DB operation) ───────────────
    const { data: mergeResult, error: mergeError } = await supabase.rpc(
      'merge_retell_call_event',
      {
        p_org_id: orgId,
        p_call_id: callId,
        p_agent_id: agentId,
        p_event_type: eventType,
        p_payload: webhookBody,
        p_payload_hash: payloadHash,
        p_received_at: new Date().toISOString(),
      }
    );

    if (mergeError) {
      console.error(`[retell-webhook][${corrId}] merge RPC error:`, mergeError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to process webhook event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isNew = mergeResult === true;
    const elapsed = Date.now() - startTime;

    if (!isNew) {
      // Duplicate event — fast-ack with 204
      console.log(`[retell-webhook][${corrId}] duplicate event, ack in ${elapsed}ms`);
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    console.log(`[retell-webhook][${corrId}] merged event=${eventType} org=${orgId.substring(0, 8)}… in ${elapsed}ms`);

    // ── Step 7: Fast-ack — return 204 immediately ─────────────────────────
    // Any optional secondary work runs in background via EdgeRuntime.waitUntil
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(
        backgroundEnrichment(supabase, callId, eventType, orgId)
      );
    }

    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[retell-webhook][${corrId}] unhandled error in ${elapsed}ms:`, error instanceof Error ? error.message : 'unknown');

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
