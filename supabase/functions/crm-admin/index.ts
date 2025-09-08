import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RetryRequest {
  lead_id?: string
  organization_id?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (req.method === 'POST') {
      const requestData = await req.json()
      
      if (requestData.action === 'get_status') {
        // Get CRM sync status for admin dashboard
        const { organization_id, limit = 50 } = requestData

        if (!organization_id) {
          return new Response(
            JSON.stringify({ error: 'organization_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Get recent sync attempts
        const { data: outboxEntries, error: outboxError } = await supabase
          .from('crm_outbox')
          .select(`
            *,
            leads:lead_id (
              full_name,
              email,
              crm_sync_status,
              crm_synced_at,
              crm_url
            )
          `)
          .eq('organization_id', organization_id)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (outboxError) {
          throw new Error(`Failed to fetch sync history: ${outboxError.message}`)
        }

        // Get summary stats
        const { data: stats, error: statsError } = await supabase
          .from('crm_outbox')
          .select('status')
          .eq('organization_id', organization_id)

        if (statsError) {
          throw new Error(`Failed to fetch sync stats: ${statsError.message}`)
        }

        const summary = {
          total: stats?.length || 0,
          completed: stats?.filter(s => s.status === 'completed').length || 0,
          pending: stats?.filter(s => s.status === 'pending').length || 0,
          failed: stats?.filter(s => s.status === 'failed').length || 0,
          processing: stats?.filter(s => s.status === 'processing').length || 0
        }

        return new Response(
          JSON.stringify({
            success: true,
            entries: outboxEntries || [],
            summary
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (requestData.action === 'retry') {
        const { lead_id, organization_id } = requestData

        if (lead_id) {
          // Retry specific lead
          await supabase
            .from('crm_outbox')
            .update({
              status: 'pending',
              next_attempt_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('lead_id', lead_id)

          // Trigger worker immediately
          await fetch(`${supabaseUrl}/functions/v1/suitecrm-sync-worker`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json'
            }
          })

          return new Response(
            JSON.stringify({
              success: true,
              message: `Retry queued for lead ${lead_id}`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (organization_id) {
          // Retry all failed for organization
          await supabase
            .from('crm_outbox')
            .update({
              status: 'pending',
              next_attempt_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('organization_id', organization_id)
            .eq('status', 'failed')

          // Trigger worker immediately
          await fetch(`${supabaseUrl}/functions/v1/suitecrm-sync-worker`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json'
            }
          })

          return new Response(
            JSON.stringify({
              success: true,
              message: `Retry queued for all failed syncs in organization ${organization_id}`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ error: 'lead_id or organization_id is required for retry' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ error: 'Invalid action. Use "get_status" or "retry"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('CRM Admin API error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})