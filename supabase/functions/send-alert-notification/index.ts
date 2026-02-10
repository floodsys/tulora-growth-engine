import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { Resend } from "npm:resend@2.0.0";
import { getCorsHeaders } from '../_shared/cors.ts'

interface AlertNotificationRequest {
  organization_id: string;
  alert_id: string;
  rule_name: string;
  severity: string;
  event_count: number;
  threshold: number;
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

    const {
      organization_id,
      alert_id,
      rule_name,
      severity,
      event_count,
      threshold
    }: AlertNotificationRequest = await req.json();

    console.log(`Sending notification for alert ${alert_id} in organization ${organization_id}`);

    // Get organization details and admin users
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select(`
        name,
        owner_user_id,
        profiles!organizations_owner_user_id_fkey(email, full_name)
      `)
      .eq('id', organization_id)
      .single();

    if (orgError || !orgData) {
      console.error('Error fetching organization:', orgError);
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get admin members
    const { data: adminMembers, error: membersError } = await supabase
      .from('organization_members')
      .select(`
        user_id,
        profiles!organization_members_user_id_fkey(email, full_name)
      `)
      .eq('organization_id', organization_id)
      .eq('role', 'admin')
      .eq('seat_active', true);

    if (membersError) {
      console.error('Error fetching admin members:', membersError);
    }

    // Collect all admin emails
    const adminEmails: string[] = [];

    // Add owner email
    if (orgData.profiles?.email) {
      adminEmails.push(orgData.profiles.email);
    }

    // Add admin member emails
    if (adminMembers) {
      for (const member of adminMembers) {
        if (member.profiles?.email && !adminEmails.includes(member.profiles.email)) {
          adminEmails.push(member.profiles.email);
        }
      }
    }

    console.log(`Sending notifications to ${adminEmails.length} admins:`, adminEmails);

    // Check if this alert is from test_invites channel (should not send emails)
    if (rule_name === 'test_invites_alert' || metadata?.channel === 'test_invites') {
      console.log('Skipping email notification for test_invites channel');
      return new Response(
        JSON.stringify({
          success: true,
          notification_sent: false,
          admin_count: adminEmails.length,
          message: 'Email skipped for test channel'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Send email notifications if Resend API key is available
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey && adminEmails.length > 0) {
      const resend = new Resend(resendApiKey);

      const alertTypeMap: Record<string, string> = {
        'rapid_role_changes': 'Rapid Role Changes',
        'failed_invite_acceptances': 'Failed Invite Acceptances',
        'billing_payment_failures': 'Billing Payment Failures',
        'rls_authorization_failures': 'Authorization Failures'
      };

      const alertTypeName = alertTypeMap[rule_name] || rule_name;
      const severityColor = severity === 'critical' ? '#dc2626' : severity === 'high' ? '#ea580c' : '#d97706';

      try {
        const emailResponse = await resend.emails.send({
          from: 'Security Alerts <alerts@resend.dev>',
          to: adminEmails,
          subject: `🚨 Security Alert: ${alertTypeName} Detected`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: ${severityColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">🚨 Security Alert</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Organization: ${orgData.name}</p>
              </div>
              
              <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
                <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
                  <h2 style="color: ${severityColor}; margin: 0 0 15px 0;">${alertTypeName}</h2>
                  <p style="margin: 0 0 10px 0; color: #374151;">
                    <strong>Severity:</strong> <span style="color: ${severityColor}; text-transform: uppercase; font-weight: bold;">${severity}</span>
                  </p>
                  <p style="margin: 0 0 10px 0; color: #374151;">
                    <strong>Events detected:</strong> ${event_count} (threshold: ${threshold})
                  </p>
                  <p style="margin: 0 0 15px 0; color: #374151;">
                    <strong>Rule:</strong> ${rule_name}
                  </p>
                  
                  <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 15px 0;">
                    <p style="margin: 0; color: #92400e; font-weight: 500;">
                      ⚠️ This alert indicates potentially suspicious activity in your organization. 
                      Please review your audit logs and take appropriate action if necessary.
                    </p>
                  </div>
                  
                  <p style="margin: 15px 0 0 0; color: #6b7280; font-size: 14px;">
                    View the full details in your organization's alerts panel to see the source events and take action.
                  </p>
                </div>
              </div>
              
              <div style="background: #f3f4f6; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; color: #6b7280; font-size: 12px;">
                This is an automated security alert from your organization's monitoring system.
              </div>
            </div>
          `,
        });

        console.log('Email notification sent successfully:', emailResponse);
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
        // Don't fail the entire function if email fails
      }
    } else {
      console.log('No Resend API key configured or no admin emails found, skipping email notification');
    }

    return new Response(
      JSON.stringify({
        success: true,
        notification_sent: true,
        admin_count: adminEmails.length,
        message: `Notification sent for alert ${alert_id}`
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('Error in send-alert-notification function:', error);
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