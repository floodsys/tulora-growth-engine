import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Import SuiteCRM service
import { SuiteCRMService, createSuiteCRMService } from '../contact-sales/_lib/suitecrm-service.ts'
import { mapLeadToSuiteCRM } from '../contact-sales/_lib/suitecrm-mapping.ts'

interface SyncRequest {
  lead_id: string
}

interface LeadData {
  id: string
  organization_id: string
  full_name: string
  name: string
  email: string
  phone?: string
  company?: string
  message?: string
  inquiry_type?: string
  product_line?: string
  source?: string
  referrer?: string
  page_url?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  ip_country?: string
  marketing_opt_in?: boolean
}

async function syncLeadToSuiteCRM(leadId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Get lead data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) {
      throw new Error(`Lead not found: ${leadError?.message}`)
    }

    // Update status to syncing
    await supabase
      .from('leads')
      .update({ 
        crm_sync_status: 'syncing',
        crm_sync_error: null 
      })
      .eq('id', leadId)

    // Create SuiteCRM service
    const suiteCRMService = createSuiteCRMService()
    if (!suiteCRMService) {
      throw new Error('SuiteCRM not configured')
    }

    // Sync lead to SuiteCRM
    const syncResult = await suiteCRMService.syncLead(lead as LeadData)

    if (syncResult.success && syncResult.leadId) {
      // Generate deep link to SuiteCRM lead
      const baseUrl = Deno.env.get('SUITECRM_BASE_URL')?.replace(/\/$/, '') || ''
      const crmUrl = `${baseUrl}/#/Leads/view/${syncResult.leadId}`

      // Update lead with success
      await supabase
        .from('leads')
        .update({
          crm_sync_status: 'synced',
          crm_id: syncResult.leadId,
          crm_url: crmUrl,
          crm_synced_at: new Date().toISOString(),
          crm_sync_error: null
        })
        .eq('id', leadId)

      // Mark outbox entry as completed
      await supabase
        .from('crm_outbox')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('lead_id', leadId)

      console.log(`Lead ${leadId} synced successfully to SuiteCRM: ${syncResult.leadId}`)
      
      return {
        success: true,
        leadId: syncResult.leadId,
        crmUrl,
        message: syncResult.message
      }
    } else {
      throw new Error(syncResult.message || 'Unknown sync error')
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Failed to sync lead ${leadId}:`, errorMessage)

    // Update lead with error
    await supabase
      .from('leads')
      .update({
        crm_sync_status: 'failed',
        crm_sync_error: errorMessage
      })
      .eq('id', leadId)

    // Update outbox entry with error and schedule retry
    const { data: outboxEntry } = await supabase
      .from('crm_outbox')
      .select('attempt_count')
      .eq('lead_id', leadId)
      .single()

    const attemptCount = (outboxEntry?.attempt_count || 0) + 1
    
    // Calculate next retry delay: 5m, 30m, 2h, 24h
    let retryDelay: string
    switch (attemptCount) {
      case 1: retryDelay = '5 minutes'; break
      case 2: retryDelay = '30 minutes'; break  
      case 3: retryDelay = '2 hours'; break
      default: retryDelay = '24 hours'; break
    }

    const nextAttempt = new Date()
    nextAttempt.setTime(nextAttempt.getTime() + getRetryDelayMs(attemptCount))

    await supabase
      .from('crm_outbox')
      .update({
        attempt_count: attemptCount,
        last_error: errorMessage,
        next_attempt_at: nextAttempt.toISOString(),
        status: attemptCount >= 10 ? 'failed' : 'pending', // Max 10 attempts
        updated_at: new Date().toISOString()
      })
      .eq('lead_id', leadId)

    return {
      success: false,
      error: errorMessage,
      nextRetry: nextAttempt.toISOString(),
      attemptCount
    }
  }
}

function getRetryDelayMs(attemptCount: number): number {
  switch (attemptCount) {
    case 1: return 5 * 60 * 1000      // 5 minutes
    case 2: return 30 * 60 * 1000     // 30 minutes
    case 3: return 2 * 60 * 60 * 1000 // 2 hours
    default: return 24 * 60 * 60 * 1000 // 24 hours
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { lead_id } = await req.json()

    if (!lead_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'lead_id is required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const result = await syncLeadToSuiteCRM(lead_id)

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Request processing error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})