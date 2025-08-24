import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyticsEvent {
  organization_id: string;
  event_id: string;
  action: string;
  target_type: string;
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

    const { event }: { event: AnalyticsEvent } = await req.json();

    if (!event || !event.organization_id) {
      return new Response(
        JSON.stringify({ error: 'Event and organization_id are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`Processing analytics for organization: ${event.organization_id}, action: ${event.action}`);

    // Get organization analytics configuration
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('analytics_config')
      .eq('id', event.organization_id)
      .single();

    if (orgError || !orgData?.analytics_config) {
      console.log('No analytics configuration found for organization');
      return new Response(
        JSON.stringify({ success: true, message: 'No analytics configured' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const analyticsConfig = orgData.analytics_config;
    
    if (!analyticsConfig.enabled || analyticsConfig.opted_out) {
      console.log('Analytics disabled or opted out');
      return new Response(
        JSON.stringify({ success: true, message: 'Analytics disabled' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Send to PostHog if configured
    if (analyticsConfig.posthog?.enabled && analyticsConfig.posthog?.api_key) {
      await sendToPostHog(event, analyticsConfig.posthog);
    }

    // Send to Segment if configured
    if (analyticsConfig.segment?.enabled && analyticsConfig.segment?.write_key) {
      await sendToSegment(event, analyticsConfig.segment);
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: event.event_id,
        message: 'Analytics events sent successfully'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('Error in send-analytics function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
};

async function sendToPostHog(event: AnalyticsEvent, config: any) {
  try {
    const posthogEvent = {
      api_key: config.api_key,
      event: `audit_${event.action}`,
      properties: {
        distinct_id: `org_${event.organization_id}`,
        organization_id: event.organization_id,
        action: event.action,
        target_type: event.target_type,
        actor_role: event.actor_role_snapshot,
        status: event.status,
        channel: event.channel,
        timestamp: event.created_at,
        // Only include safe metadata properties
        ...getSafeAnalyticsProperties(event.metadata)
      },
      timestamp: event.created_at
    };

    const response = await fetch(`${config.host || 'https://app.posthog.com'}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(posthogEvent)
    });

    if (!response.ok) {
      console.error('PostHog API error:', response.status, await response.text());
    } else {
      console.log('Event sent to PostHog successfully');
    }
  } catch (error) {
    console.error('Error sending to PostHog:', error);
  }
}

async function sendToSegment(event: AnalyticsEvent, config: any) {
  try {
    const segmentEvent = {
      userId: `org_${event.organization_id}`,
      event: `Audit ${event.action}`,
      properties: {
        organization_id: event.organization_id,
        action: event.action,
        target_type: event.target_type,
        actor_role: event.actor_role_snapshot,
        status: event.status,
        channel: event.channel,
        // Only include safe metadata properties
        ...getSafeAnalyticsProperties(event.metadata)
      },
      timestamp: event.created_at
    };

    const auth = btoa(`${config.write_key}:`);
    
    const response = await fetch('https://api.segment.io/v1/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify(segmentEvent)
    });

    if (!response.ok) {
      console.error('Segment API error:', response.status, await response.text());
    } else {
      console.log('Event sent to Segment successfully');
    }
  } catch (error) {
    console.error('Error sending to Segment:', error);
  }
}

function getSafeAnalyticsProperties(metadata: any): Record<string, any> {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  // Only include specific safe properties for analytics
  const safeProps: Record<string, any> = {};
  
  // Include non-PII metadata
  const allowedProps = [
    'action_type', 'resource_count', 'duration_ms', 'success_rate',
    'feature_used', 'plan_type', 'integration_type', 'device_type',
    'browser_type', 'operation_type', 'batch_size', 'error_category'
  ];

  for (const prop of allowedProps) {
    if (metadata[prop] !== undefined) {
      safeProps[prop] = metadata[prop];
    }
  }

  return safeProps;
}

serve(handler);