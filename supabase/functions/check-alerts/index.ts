import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { getCorsHeaders } from '../_shared/cors.ts'

interface CheckAlertsRequest {
  organization_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { organization_id }: CheckAlertsRequest = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'Organization ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`Checking alerts for organization: ${organization_id}`);

    // Call the check_alert_rules function
    const { data: alertData, error: alertError } = await supabase.rpc('check_alert_rules', {
      p_org_id: organization_id
    });

    if (alertError) {
      console.error('Error checking alert rules:', alertError);
      return new Response(
        JSON.stringify({ error: 'Failed to check alert rules', details: alertError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('Alert check result:', alertData);

    // If alerts were triggered, send notifications
    if (alertData?.triggered_alerts && alertData.triggered_alerts.length > 0) {
      console.log(`${alertData.triggered_alerts.length} alerts triggered, sending notifications`);

      // Call notification function for each triggered alert
      for (const alert of alertData.triggered_alerts) {
        try {
          const { error: notificationError } = await supabase.functions.invoke('send-alert-notification', {
            body: {
              organization_id,
              alert_id: alert.alert_id,
              rule_name: alert.rule_name,
              severity: alert.severity,
              event_count: alert.event_count,
              threshold: alert.threshold
            }
          });

          if (notificationError) {
            console.error(`Failed to send notification for alert ${alert.alert_id}:`, notificationError);
          } else {
            console.log(`Notification sent for alert ${alert.alert_id}`);
          }
        } catch (notificationError) {
          console.error(`Error sending notification for alert ${alert.alert_id}:`, notificationError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        alerts_checked: true,
        triggered_alerts: alertData?.triggered_alerts || [],
        message: `Checked alerts for organization ${organization_id}`
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('Error in check-alerts function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
};

serve(handler);