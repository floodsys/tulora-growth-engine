import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

interface ExportRequest {
  organizationId: string;
  channel?: string;
  format: 'csv' | 'json';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Authorization required', { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    // Parse request body
    const body: ExportRequest = await req.json();
    const { organizationId, channel, format } = body;

    if (!organizationId) {
      return new Response('Organization ID required', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    console.log(`Exporting logs for org ${organizationId}, channel: ${channel || 'all'}, format: ${format}`);

    // Export logs using the database function
    const { data: logs, error } = await supabase
      .rpc('export_logs_before_purge', {
        p_org_id: organizationId,
        p_channel: channel || null
      });

    if (error) {
      console.error('Export failed:', error);
      return new Response(
        JSON.stringify({ error: 'Export failed', details: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!logs || logs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No logs found matching criteria' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Format the response based on requested format
    if (format === 'csv') {
      // Convert to CSV format
      const headers = Object.keys(logs[0]).join(',');
      const rows = logs.map(log => 
        Object.values(log).map(value => {
          if (typeof value === 'object') {
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          }
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      );
      
      const csv = [headers, ...rows].join('\n');
      
      return new Response(csv, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${organizationId}-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    } else {
      // Return JSON format
      return new Response(
        JSON.stringify({ logs, count: logs.length }, null, 2),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="audit-logs-${organizationId}-${new Date().toISOString().split('T')[0]}.json"`
          }
        }
      );
    }

  } catch (error) {
    console.error('Error in export-logs function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});