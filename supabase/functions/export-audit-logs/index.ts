import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExportRequest {
  organization_id: string;
  format: 'csv' | 'json';
  date_from?: string;
  date_to?: string;
  channel?: string;
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Verify the user token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { organization_id, format, date_from, date_to, channel }: ExportRequest = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'Organization ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`Exporting audit logs for organization: ${organization_id}, format: ${format}`);

    // Verify user has admin access to the organization
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_org_admin', { 
      org_id: organization_id 
    });

    if (adminError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Build query with filters
    let query = supabase
      .from('audit_log')
      .select('*')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false });

    if (date_from) {
      query = query.gte('created_at', date_from);
    }

    if (date_to) {
      query = query.lte('created_at', date_to);
    }

    if (channel) {
      query = query.eq('channel', channel);
    }

    const { data: logs, error: logsError } = await query;

    if (logsError) {
      console.error('Error fetching logs:', logsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch audit logs', details: logsError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`Exporting ${logs?.length || 0} audit log entries`);

    if (format === 'json') {
      return new Response(
        JSON.stringify({
          export_info: {
            organization_id,
            exported_at: new Date().toISOString(),
            date_from: date_from || 'all',
            date_to: date_to || 'all',
            channel: channel || 'all',
            total_entries: logs?.length || 0
          },
          logs: logs || []
        }, null, 2),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="audit-logs-${organization_id}-${new Date().toISOString().split('T')[0]}.json"`,
            ...corsHeaders
          }
        }
      );
    } else if (format === 'csv') {
      // Convert to CSV
      const csvHeaders = [
        'ID',
        'Created At',
        'Channel',
        'Action',
        'Target Type',
        'Target ID',
        'Actor User ID',
        'Actor Role',
        'Status',
        'Error Code',
        'IP Hash',
        'User Agent',
        'Request ID',
        'Metadata'
      ];

      const csvRows = (logs || []).map(log => [
        log.id,
        log.created_at,
        log.channel,
        log.action,
        log.target_type,
        log.target_id || '',
        log.actor_user_id || '',
        log.actor_role_snapshot,
        log.status,
        log.error_code || '',
        log.ip_hash || '',
        log.user_agent || '',
        log.request_id || '',
        JSON.stringify(log.metadata || {})
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => 
          row.map(field => 
            typeof field === 'string' && field.includes(',') 
              ? `"${field.replace(/"/g, '""')}"` 
              : field
          ).join(',')
        )
      ].join('\n');

      return new Response(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${organization_id}-${new Date().toISOString().split('T')[0]}.csv"`,
          ...corsHeaders
        }
      });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid format. Must be csv or json' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('Error in export-audit-logs function:', error);
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