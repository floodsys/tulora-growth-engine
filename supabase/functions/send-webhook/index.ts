import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { requireOrgActive, createBlockedResponse, resolveWebhookTarget } from '../_shared/org-guard.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookEvent {
  organization_id: string;
  event_id: string;
  action: string;
  target_type: string;
  target_id?: string;
  actor_user_id?: string;
  actor_role_snapshot: string;
  status: string;
  channel: string;
  created_at: string;
  metadata: any;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { event }: { event: WebhookEvent } = await req.json();

    if (!event || !event.organization_id) {
      return new Response(
        JSON.stringify({ error: 'Event and organization_id are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`Processing webhook for organization: ${event.organization_id}, action: ${event.action}`);

    // Check organization status before proceeding with webhook dispatch
    const guardResult = await requireOrgActive({
      organizationId: event.organization_id,
      action: 'webhook.dispatch',
      path: '/send-webhook',
      method: req.method,
      actorUserId: event.actor_user_id,
      supabase
    });

    if (!guardResult.ok) {
      return createBlockedResponse(guardResult, corsHeaders);
    }

    // Get organization webhook configuration
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('webhook_config')
      .eq('id', event.organization_id)
      .single();

    if (orgError || !orgData?.webhook_config) {
      console.log('No webhook configuration found for organization');
      return new Response(
        JSON.stringify({ success: true, message: 'No webhook configured' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const webhookConfig = orgData.webhook_config;
    
    if (!webhookConfig.enabled || !webhookConfig.url) {
      console.log('Webhook not enabled or no URL configured');
      return new Response(
        JSON.stringify({ success: true, message: 'Webhook disabled or no URL' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check if event should be sent based on filters
    const filters = webhookConfig.filters || {};
    
    // Always exclude test_invites channel from webhooks
    if (event.channel === 'test_invites') {
      console.log('Excluding test_invites channel from webhook');
      return new Response(
        JSON.stringify({ success: true, message: 'Test channel excluded from webhooks' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    if (filters.channels && !filters.channels.includes(event.channel)) {
      console.log(`Event channel ${event.channel} not in allowed channels:`, filters.channels);
      return new Response(
        JSON.stringify({ success: true, message: 'Event filtered by channel' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (filters.actions && !filters.actions.includes(event.action)) {
      console.log(`Event action ${event.action} not in allowed actions:`, filters.actions);
      return new Response(
        JSON.stringify({ success: true, message: 'Event filtered by action' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Prepare webhook payload with PII-safe data
    const webhookPayload = {
      event_id: event.event_id,
      organization_id: event.organization_id,
      timestamp: event.created_at,
      event_type: 'audit_log',
      data: {
        action: event.action,
        target_type: event.target_type,
        target_id: event.target_id,
        actor_role: event.actor_role_snapshot,
        status: event.status,
        channel: event.channel,
        // Remove PII from metadata
        metadata: stripPII(event.metadata)
      }
    };

    // Generate HMAC signature if secret is configured
    let signature: string | undefined;
    if (webhookConfig.secret) {
      const payloadString = JSON.stringify(webhookPayload);
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(webhookConfig.secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadString));
      signature = 'sha256=' + Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }

    // Send webhook with retry logic
    const success = await sendWebhookWithRetry(
      webhookConfig.url,
      webhookPayload,
      signature,
      webhookConfig.retry_config || { max_retries: 3, initial_delay: 1000 }
    );

    return new Response(
      JSON.stringify({
        success,
        event_id: event.event_id,
        webhook_url: webhookConfig.url,
        message: success ? 'Webhook sent successfully' : 'Webhook failed after retries'
      }),
      {
        status: success ? 200 : 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('Error in send-webhook function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
};

async function sendWebhookWithRetry(
  url: string,
  payload: any,
  signature?: string,
  retryConfig = { max_retries: 3, initial_delay: 1000 }
): Promise<boolean> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'AuditLog-Webhook/1.0'
  };

  if (signature) {
    headers['X-Signature-256'] = signature;
  }

  for (let attempt = 0; attempt <= retryConfig.max_retries; attempt++) {
    try {
      console.log(`Webhook attempt ${attempt + 1} to ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log(`Webhook sent successfully on attempt ${attempt + 1}`);
        return true;
      }

      console.log(`Webhook attempt ${attempt + 1} failed with status: ${response.status}`);
      
      if (attempt < retryConfig.max_retries) {
        const delay = retryConfig.initial_delay * Math.pow(2, attempt); // Exponential backoff
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
    } catch (error) {
      console.error(`Webhook attempt ${attempt + 1} error:`, error);
      
      if (attempt < retryConfig.max_retries) {
        const delay = retryConfig.initial_delay * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`Webhook failed after ${retryConfig.max_retries + 1} attempts`);
  return false;
}

function stripPII(metadata: any): any {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  const sensitiveFields = [
    'email', 'phone', 'ip_address', 'user_agent', 'password', 'token',
    'ssn', 'credit_card', 'personal_id', 'full_name', 'address'
  ];

  const cleaned = { ...metadata };

  for (const field of sensitiveFields) {
    if (cleaned[field]) {
      if (typeof cleaned[field] === 'string') {
        // Keep first and last character, replace middle with ***
        const value = cleaned[field];
        if (value.length > 2) {
          cleaned[field] = value[0] + '***' + value[value.length - 1];
        } else {
          cleaned[field] = '***';
        }
      } else {
        cleaned[field] = '[REDACTED]';
      }
    }
  }

  // Recursively clean nested objects
  for (const key in cleaned) {
    if (typeof cleaned[key] === 'object' && cleaned[key] !== null) {
      cleaned[key] = stripPII(cleaned[key]);
    }
  }

  return cleaned;
}

serve(handler);
