import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getSuiteCRMClient } from "../_shared/suitecrm.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Types and interfaces for lead sync
interface LeadData {
  id: string
  organization_id: string
  inquiry_type?: 'contact' | 'enterprise'
  full_name: string
  name: string
  email: string
  phone?: string
  company?: string
  message?: string
  product_interest?: string
  product_line?: string
  additional_requirements?: string
  expected_volume_label?: string
  expected_volume_value?: string
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

interface SuiteCRMLeadPayload {
  first_name: string
  last_name: string
  email1: string
  phone_work?: string
  account_name?: string
  lead_source: string
  description: string
  product_line_c?: string
  product_interest_c?: string
  inquiry_type_c: string
  expected_volume_c?: string
  expected_volume_code_c?: string
  utm_source_c?: string
  utm_medium_c?: string
  utm_campaign_c?: string
  utm_term_c?: string
  utm_content_c?: string
  page_url_c?: string
  referrer_c?: string
  ip_country_c?: string
  marketing_opt_in_c?: boolean
  external_id_c: string
}

interface SyncRequest {
  lead_id: string
}

// Utility functions
function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const trimmed = fullName.trim()
  const parts = trimmed.split(/\s+/)
  
  if (parts.length === 1) {
    return { first_name: '', last_name: parts[0] }
  } else {
    const firstName = parts[0]
    const lastName = parts.slice(1).join(' ')
    return { first_name: firstName, last_name: lastName }
  }
}

function composeDescription(lead: LeadData): string {
  const parts: string[] = []
  
  if (lead.product_interest) {
    parts.push(`Product Interest: ${lead.product_interest}`)
  }
  if (lead.product_line) {
    parts.push(`Product Line: ${lead.product_line}`)
  }
  
  const content = lead.inquiry_type === 'contact' ? lead.message : lead.additional_requirements
  if (content) {
    parts.push(`Details: ${content}`)
  }
  
  if (lead.expected_volume_label) {
    parts.push(`Expected Volume: ${lead.expected_volume_label}`)
  }
  
  const trackingParts: string[] = []
  if (lead.page_url) trackingParts.push(`Page: ${lead.page_url}`)
  if (lead.referrer) trackingParts.push(`Referrer: ${lead.referrer}`)
  if (lead.utm_source) trackingParts.push(`UTM Source: ${lead.utm_source}`)
  if (lead.utm_medium) trackingParts.push(`UTM Medium: ${lead.utm_medium}`)
  if (lead.utm_campaign) trackingParts.push(`UTM Campaign: ${lead.utm_campaign}`)
  if (lead.utm_term) trackingParts.push(`UTM Term: ${lead.utm_term}`)
  if (lead.utm_content) trackingParts.push(`UTM Content: ${lead.utm_content}`)
  
  if (trackingParts.length > 0) {
    parts.push(`Tracking: ${trackingParts.join(', ')}`)
  }
  
  return parts.join('\n\n')
}

function mapLeadSource(inquiryType?: 'contact' | 'enterprise'): string {
  return inquiryType === 'contact' 
    ? 'Website - Contact Us'
    : 'Website - Enterprise Sales'
}

function mapLeadToSuiteCRM(lead: LeadData): SuiteCRMLeadPayload {
  const { first_name, last_name } = splitFullName(lead.full_name || lead.name)
  
  return {
    first_name,
    last_name,
    email1: lead.email,
    phone_work: lead.phone || undefined,
    account_name: lead.company || undefined,
    lead_source: mapLeadSource(lead.inquiry_type),
    description: composeDescription(lead),
    product_line_c: lead.product_line || undefined,
    product_interest_c: lead.product_interest || undefined,
    inquiry_type_c: lead.inquiry_type || 'contact',
    expected_volume_c: lead.expected_volume_label || undefined,
    expected_volume_code_c: lead.expected_volume_value || undefined,
    utm_source_c: lead.utm_source || undefined,
    utm_medium_c: lead.utm_medium || undefined,
    utm_campaign_c: lead.utm_campaign || undefined,
    utm_term_c: lead.utm_term || undefined,
    utm_content_c: lead.utm_content || undefined,
    page_url_c: lead.page_url || undefined,
    referrer_c: lead.referrer || undefined,
    ip_country_c: lead.ip_country || undefined,
    marketing_opt_in_c: lead.marketing_opt_in || undefined,
    external_id_c: lead.id
  }
}

async function findLeadByExternalId(client: any, externalId: string): Promise<string | null> {
  try {
    const response = await client.crmFetch(`module/Leads?filter[external_id_c]=${encodeURIComponent(externalId)}`)
    
    if (!response.ok) {
      console.warn(`Failed to search for lead: ${response.status}`)
      return null
    }
    
    const data = await response.json()
    
    if (data.data && data.data.length > 0) {
      return data.data[0].id
    }
    
    return null
  } catch (error) {
    console.warn('Failed to find lead by external ID:', error instanceof Error ? error.message : 'Unknown error')
    return null
  }
}

export const VERSION = "2025-09-08-2"

async function syncLeadToSuiteCRM(leadId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const version = VERSION

  try {
    // Get shared SuiteCRM client
    const client = getSuiteCRMClient()
    const mode = client.getMode()

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

    // Map lead data to SuiteCRM format
    const payload = mapLeadToSuiteCRM(lead as LeadData)
    console.info('SuiteCRM Lead payload:', JSON.stringify(payload, null, 2))

    // Check if lead already exists in SuiteCRM
    const existingLeadId = await findLeadByExternalId(client, payload.external_id_c)
    
    let response: Response
    let leadCrmId: string | undefined

    if (existingLeadId) {
      // Update existing lead
      console.info({ mode, endpoint: "module/Leads", action: "update", existing_id: existingLeadId })
      response = await client.crmFetch(`module/Leads/${existingLeadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { attributes: payload } })
      })
      leadCrmId = existingLeadId
    } else {
      // Create new lead
      console.info({ mode, endpoint: "module/Leads", action: "create" })
      response = await client.crmFetch('module/Leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { type: 'Leads', attributes: payload } })
      })
    }

    console.info({ mode, endpoint: "module/Leads", status: response.status })

    if (!response.ok) {
      // Parse error response
      let errorMessage = `SuiteCRM API error (${response.status})`
      try {
        const errorData = await response.json()
        if (errorData.errors && errorData.errors.length > 0) {
          errorMessage = errorData.errors.map((err: any) => err.detail || err.title || 'Unknown error').join('; ')
        } else if (errorData.error) {
          errorMessage = errorData.error
        }
      } catch {
        // If JSON parsing fails, get first 400 chars of response text
        try {
          const errorText = await response.text()
          errorMessage = errorText.substring(0, 400)
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
      }

      return {
        ok: false,
        mode,
        error: errorMessage,
        status: response.status
      }
    }

    // Parse successful response
    const responseData = await response.json()
    if (!existingLeadId && responseData.data?.id) {
      leadCrmId = responseData.data.id
    }

    // Generate deep link to SuiteCRM lead
    const baseUrl = Deno.env.get('SUITECRM_BASE_URL')?.replace(/\/$/, '') || ''
    const crmUrl = leadCrmId ? `${baseUrl}/#/Leads/view/${leadCrmId}` : undefined

    // Update lead with success in database
    await supabase
      .from('leads')
      .update({
        crm_sync_status: 'synced',
        crm_id: leadCrmId,
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

    console.info(`Lead ${leadId} synced successfully to SuiteCRM: ${leadCrmId}`)
    
    return {
      ok: true,
      mode,
      result: {
        leadId: leadCrmId,
        crmUrl,
        action: existingLeadId ? 'updated' : 'created',
        message: existingLeadId 
          ? `Lead updated successfully (ID: ${leadCrmId})` 
          : `Lead created successfully (ID: ${leadCrmId})`
      },
      version
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Failed to sync lead ${leadId}:`, errorMessage)

    // Update lead with error in database
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
      ok: false,
      mode: 'client_credentials',
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
          ok: false, 
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
        ok: false, 
        mode: 'client_credentials',
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})