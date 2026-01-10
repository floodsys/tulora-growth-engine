import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Creates a Supabase client using the user's JWT from the Authorization header.
 * This client has the permissions of the authenticated user.
 */
function createUserClient(authHeader: string | null): SupabaseClient | null {
  if (!authHeader) return null
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  
  if (!supabaseUrl || !supabaseAnonKey) return null
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader }
    }
  })
}

/**
 * Verifies that a user is a member or admin of the specified organization.
 * Uses the service role client to check organization_members table.
 */
async function verifyOrgMembership(
  serviceClient: SupabaseClient,
  userId: string, 
  organizationId: string
): Promise<boolean> {
  const { data, error } = await serviceClient
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  
  if (error) {
    console.error('Error checking org membership:', error)
    return false
  }
  
  return data !== null
}

// Inline types and interfaces needed for SuiteCRM sync
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

interface SuiteCRMAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
}

interface SuiteCRMConfig {
  baseUrl: string
  authMode?: string
  username?: string
  password?: string
  clientId?: string
  clientSecret?: string
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

// SuiteCRM Service Class
class SuiteCRMService {
  private config: SuiteCRMConfig
  private accessToken?: string
  private tokenExpiry?: Date

  constructor(config: SuiteCRMConfig) {
    this.config = config
  }

  async authenticate(): Promise<void> {
    try {
      const authMode = this.config.authMode || 'v8_client_credentials'
      
      let authPayload: any = {
        client_id: this.config.clientId || 'suitecrm_client',
        client_secret: this.config.clientSecret || ''
      }

      // Only add scope if SUITECRM_SCOPE environment variable is set and non-empty
      const scopeValue = Deno.env.get('SUITECRM_SCOPE')
      if (scopeValue && scopeValue.trim() !== '') {
        authPayload.scope = scopeValue.trim()
      }

      if (authMode === 'v8_client_credentials') {
        authPayload.grant_type = 'client_credentials'
      } else {
        authPayload.grant_type = 'password'
        authPayload.username = this.config.username
        authPayload.password = this.config.password
      }

      const response = await fetch(`${this.config.baseUrl}/Api/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authPayload)
      })

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`)
      }

      const authData: SuiteCRMAuthResponse = await response.json()
      this.accessToken = authData.access_token
      
      const expirySeconds = authData.expires_in - 300
      this.tokenExpiry = new Date(Date.now() + (expirySeconds * 1000))
      
    } catch (error) {
      throw new Error(`SuiteCRM authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiry || this.tokenExpiry <= new Date()) {
      await this.authenticate()
    }
  }

  private async apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    await this.ensureAuthenticated()
    
    const url = `${this.config.baseUrl}/Api/V8${endpoint}`
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    }

    const response = await fetch(url, { ...options, headers })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`SuiteCRM API request failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return response
  }

  async findLeadByExternalId(externalId: string): Promise<string | null> {
    try {
      const response = await this.apiRequest(`/module/Leads?filter[external_id_c]=${encodeURIComponent(externalId)}`)
      const data = await response.json()
      
      if (data.data && data.data.length > 0) {
        return data.data[0].id
      }
      
      return null
    } catch (error) {
      console.error('Failed to find lead by external ID:', error)
      return null
    }
  }

  async upsertLead(payload: SuiteCRMLeadPayload): Promise<{ success: boolean, leadId?: string, message: string }> {
    try {
      const existingLeadId = await this.findLeadByExternalId(payload.external_id_c)
      
      if (existingLeadId) {
        // Update existing lead
        const response = await this.apiRequest(`/module/Leads/${existingLeadId}`, {
          method: 'PATCH',
          body: JSON.stringify({ data: { attributes: payload } })
        })
        
        return {
          success: true,
          leadId: existingLeadId,
          message: `Lead updated successfully (ID: ${existingLeadId})`
        }
      } else {
        // Create new lead
        const response = await this.apiRequest('/module/Leads', {
          method: 'POST',
          body: JSON.stringify({ data: { type: 'Leads', attributes: payload } })
        })
        
        const data = await response.json()
        const newLeadId = data.data?.id
        
        return {
          success: true,
          leadId: newLeadId,
          message: `Lead created successfully (ID: ${newLeadId})`
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to sync lead: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  async syncLead(lead: LeadData): Promise<{ success: boolean, leadId?: string, message: string }> {
    try {
      const payload = mapLeadToSuiteCRM(lead)
      console.log('SuiteCRM Lead payload:', JSON.stringify(payload, null, 2))
      
      const syncResult = await this.upsertLead(payload)
      return syncResult
      
    } catch (error) {
      return {
        success: false,
        message: `SuiteCRM sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }
}

function createSuiteCRMService(): SuiteCRMService | null {
  const baseUrl = Deno.env.get('SUITECRM_BASE_URL')
  const clientId = Deno.env.get('SUITECRM_CLIENT_ID')
  const clientSecret = Deno.env.get('SUITECRM_CLIENT_SECRET')
  const username = Deno.env.get('SUITECRM_USERNAME')
  const password = Deno.env.get('SUITECRM_PASSWORD')
  
  if (!baseUrl || !clientId || !clientSecret) {
    console.log('SuiteCRM credentials not configured (missing base URL, client ID, or client secret), skipping CRM sync')
    return null
  }
  
  const authMode = (username && password) ? 'v8_password' : 'v8_client_credentials'
  
  return new SuiteCRMService({
    baseUrl: baseUrl.replace(/\/$/, ''),
    authMode,
    username,
    password,
    clientId,
    clientSecret
  })
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
    // ============================================================
    // AUTHENTICATION: Verify JWT and get authenticated user
    // ============================================================
    const authHeader = req.headers.get('Authorization')
    const userClient = createUserClient(authHeader)
    
    if (!userClient) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing or invalid authorization header' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get the authenticated user from the JWT
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized: Invalid or expired token' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const { lead_id, organization_id } = await req.json()

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

    // ============================================================
    // AUTHORIZATION: Verify org membership if organization_id provided
    // Only create service client AFTER user is authenticated
    // ============================================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // If organization_id is provided in the request, verify membership
    if (organization_id) {
      const isMember = await verifyOrgMembership(serviceClient, user.id, organization_id)
      
      if (!isMember) {
        console.error(`User ${user.id} is not a member of organization ${organization_id}`)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Forbidden: You are not a member of this organization' 
          }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Also verify membership based on the lead's organization_id
    // First, fetch the lead to get its organization_id
    const { data: lead, error: leadFetchError } = await serviceClient
      .from('leads')
      .select('organization_id')
      .eq('id', lead_id)
      .single()

    if (leadFetchError || !lead) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Lead not found' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify user is a member of the lead's organization
    if (lead.organization_id) {
      const isMemberOfLeadOrg = await verifyOrgMembership(serviceClient, user.id, lead.organization_id)
      
      if (!isMemberOfLeadOrg) {
        console.error(`User ${user.id} is not authorized to sync lead ${lead_id} (org: ${lead.organization_id})`)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Forbidden: You are not authorized to sync this lead' 
          }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // ============================================================
    // PRIVILEGED OPERATION: Now proceed with CRM sync using service role
    // User/org validation is complete at this point
    // ============================================================
    console.log(`User ${user.id} authorized to sync lead ${lead_id}`)
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
