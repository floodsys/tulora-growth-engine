import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting nightly usage rollup job...');

    // Get yesterday's date for processing
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = yesterday.toISOString().split('T')[0];
    const currentMonth = targetDate.slice(0, 7) + '-01';

    console.log(`Processing usage data for date: ${targetDate}, month: ${currentMonth}`);

    // Get all organizations
    const { data: organizations, error: orgError } = await supabaseClient
      .from('organizations')
      .select('id');

    if (orgError) {
      throw new Error(`Failed to get organizations: ${orgError.message}`);
    }

    let processedOrgs = 0;
    let totalMinutes = 0;
    let totalCalls = 0;

    // Process each organization
    for (const org of organizations) {
      try {
        // Aggregate call data for the target date
        const { data: callData } = await supabaseClient
          .from('retell_calls')
          .select('duration_ms, started_at')
          .eq('organization_id', org.id)
          .gte('started_at', `${targetDate}T00:00:00Z`)
          .lt('started_at', `${targetDate}T23:59:59Z`)
          .not('duration_ms', 'is', null);

        if (callData && callData.length > 0) {
          const callCount = callData.length;
          const totalDurationMs = callData.reduce((sum, call) => sum + (call.duration_ms || 0), 0);
          const minutes = Math.ceil(totalDurationMs / 60000); // Convert ms to minutes

          // Get current peak concurrency
          const { data: currentConcurrency } = await supabaseClient
            .rpc('get_current_concurrency', { p_org_id: org.id });

          // Update usage rollup for this month
          const { error: rollupError } = await supabaseClient
            .rpc('update_usage_rollup', {
              p_org_id: org.id,
              p_period: currentMonth,
              p_minutes: minutes,
              p_calls: callCount,
              p_messages: 0, // TODO: Add chat message tracking
              p_kb_ops: 0,   // TODO: Add KB operation tracking
              p_concurrency_peak: currentConcurrency || 0
            });

          if (rollupError) {
            console.error(`Failed to update rollup for org ${org.id}:`, rollupError);
          } else {
            totalMinutes += minutes;
            totalCalls += callCount;
            console.log(`Updated rollup for org ${org.id}: ${callCount} calls, ${minutes} minutes`);
          }
        }

        processedOrgs++;
      } catch (error) {
        console.error(`Error processing org ${org.id}:`, error);
      }
    }

    const result = {
      success: true,
      processed_organizations: processedOrgs,
      total_organizations: organizations.length,
      total_minutes_processed: totalMinutes,
      total_calls_processed: totalCalls,
      processing_date: targetDate,
      timestamp: new Date().toISOString()
    };

    console.log('Rollup job completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in usage rollup job:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});