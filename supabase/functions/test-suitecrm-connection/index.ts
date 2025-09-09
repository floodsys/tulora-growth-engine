import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VERSION = "2025-09-09-3" // Increment for each deploy

interface SuiteCRMAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  user?: {
    id: string
    user_name: string
    first_name?: string
    last_name?: string
  }
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute
  const maxRequests = 10
  
  const current = rateLimitMap.get(ip)
  
  if (!current || now > current.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }
  
  if (current.count >= maxRequests) {
    return { allowed: false, remaining: 0 }
  }
  
  current.count++
  return { allowed: true, remaining: maxRequests - current.count }
}

function getClientIP(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    return xff.split(',')[0].trim()
  }
  const xri = req.headers.get('x-real-ip')
  if (xri) {
    return xri
  }
  return 'unknown'
}

// Check environment variables and return presence flags
function checkSuiteCRMEnv() {
  const base_url = Deno.env.get('SUITECRM_BASE_URL')
  const client_id = Deno.env.get('SUITECRM_CLIENT_ID')
  const client_secret = Deno.env.get('SUITECRM_CLIENT_SECRET')
  const auth_mode = Deno.env.get('SUITECRM_AUTH_MODE')
  
  const envPresent = {
    base_url: !!base_url,
    client_id: !!client_id,
    client_secret: !!client_secret,
    auth_mode: !!auth_mode
  }
  
  const present = Object.entries(envPresent)
    .filter(([_, isPresent]) => isPresent)
    .map(([key, _]) => key)
  
  console.log(`[CFG] suitecrm env present: ${present.join(', ')}`)
  
  return {
    envPresent,
    config: { base_url, client_id, client_secret, auth_mode }
  }
}

async function testSuiteCRMConnection() {
  const { envPresent, config } = checkSuiteCRMEnv()
  const { base_url, client_id, client_secret, auth_mode } = config
  
  // Check if all required env vars are present
  const missingVars = Object.entries(envPresent)
    .filter(([_, isPresent]) => !isPresent)
    .map(([key, _]) => key)
  
  if (missingVars.length > 0) {
    return {
      success: false,
      error: `Missing environment variables: ${missingVars.join(', ')}`,
      env_present: envPresent
    }
  }
  
  // Clean up base URL
  const cleanBaseUrl = base_url!.replace(/\/$/, '')
  
  try {
    let authPayload: any = {
      grant_type: auth_mode === 'v8_client_credentials' ? 'client_credentials' : 'password',
      client_id,
      client_secret
    }

    // Only add scope if SUITECRM_SCOPE environment variable is set and non-empty
    const scopeValue = Deno.env.get('SUITECRM_SCOPE')
    if (scopeValue && scopeValue.trim() !== '') {
      authPayload.scope = scopeValue.trim()
    }

    // Only supporting client credentials mode via environment variables
    if (auth_mode !== 'v8_client_credentials') {
      return {
        success: false,
        error: `Auth mode '${auth_mode}' not supported, only 'v8_client_credentials' is supported`,
        env_present: envPresent
      }
    }

    console.log(`Testing SuiteCRM connection with ${auth_mode} mode to ${cleanBaseUrl}`)

    const response = await fetch(`${cleanBaseUrl}/Api/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(authPayload)
    })

    console.log(`Response status: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`SuiteCRM auth failed: ${response.status} ${response.statusText}`)
      
      // Provide sanitized error information (no secrets)
      let errorMessage = `OAuth failed: ${response.status} ${response.statusText}`
      if (errorText) {
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.error_description) {
            errorMessage += ` - ${errorJson.error_description}`
          } else if (errorJson.error) {
            errorMessage += ` - ${errorJson.error}`
          }
        } catch {
          // If not JSON, include sanitized error text
          const sanitized = errorText.substring(0, 100).replace(/[a-zA-Z0-9+/=]{20,}/g, '[REDACTED]')
          errorMessage += ` - ${sanitized}`
        }
      }
      
      return {
        success: false,
        error: errorMessage,
        env_present: envPresent
      }
    }

    const authData: SuiteCRMAuthResponse = await response.json()
    console.log('Authentication successful, received token')

    // Try to get current user info to validate the token
    try {
      const userResponse = await fetch(`${cleanBaseUrl}/Api/V8/me`, {
        headers: {
          'Authorization': `Bearer ${authData.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      let oauth_user = 'tulora-api' // default fallback
      
      if (userResponse.ok) {
        const userData = await userResponse.json()
        oauth_user = userData.data?.attributes?.user_name || 'tulora-api'
      }
      
      return {
        success: true,
        message: `OAuth successful`,
        oauth_user,
        token_type: authData.token_type,
        expires_in: authData.expires_in,
        env_present: envPresent
      }
    } catch (error) {
      // If user info fetch fails, still consider it successful if we got a token
      console.log('Could not fetch user info, but token is valid')
      return {
        success: true,
        message: `OAuth successful`,
        oauth_user: 'tulora-api',
        token_type: authData.token_type,
        expires_in: authData.expires_in,
        env_present: envPresent
      }
    }

  } catch (error) {
    console.error('SuiteCRM connection test failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message.replace(/[a-zA-Z0-9+/=]{20,}/g, '[REDACTED]') : 'Unknown error occurred',
      env_present: envPresent
    }
  }
}

// Check if user is superadmin
async function checkSuperadmin(authHeader: string | null): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }
  
  const token = authHeader.substring(7)
  const supabase = createClient(
    'https://nkjxbeypbiclvouqfjyc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ranhiZXlwYmljbHZvdXFmanljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0Nzg2NDEsImV4cCI6MjA3MTA1NDY0MX0.iuFFcJSX97MKkiBvSYLmIao9aTMrQm7zqnf4kEDraQg',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    }
  )
  
  try {
    const { data: user, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user.user) {
      return false
    }
    
    // Check if user is superadmin
    const { data, error } = await supabase.rpc('is_superadmin', { user_id: user.user.id })
    return !error && data === true
  } catch (error) {
    console.error('Superadmin check failed:', error)
    return false
  }
}

serve(async (req) => {
  const method = req.method
  const clientIP = getClientIP(req)
  
  // Handle CORS preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Method guard - only allow GET and POST
  if (method !== 'GET' && method !== 'POST') {
    return new Response(
      JSON.stringify({ 
        error: 'Method not allowed',
        version: VERSION,
        method_used: method,
        config_source: "edge_env"
      }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  // Rate limiting
  const rateLimit = checkRateLimit(clientIP)
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ 
        error: 'Rate limit exceeded',
        version: VERSION,
        method_used: method,
        config_source: "edge_env",
        rate_limit: { remaining: 0 }
      }),
      { 
        status: 429, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  // Check superadmin auth
  const authHeader = req.headers.get('authorization')
  const isSuperadmin = await checkSuperadmin(authHeader)
  
  if (!isSuperadmin) {
    return new Response(
      JSON.stringify({ 
        error: 'Superadmin authentication required',
        version: VERSION,
        method_used: method,
        config_source: "edge_env",
        rate_limit: { remaining: rateLimit.remaining }
      }),
      { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  try {
    const result = await testSuiteCRMConnection()
    
    // Build response with all required fields
    const response = {
      ...result,
      version: VERSION,
      method_used: method,
      config_source: "edge_env",
      rate_limit: { remaining: rateLimit.remaining }
    }

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Request processing error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        version: VERSION,
        method_used: method,
        config_source: "edge_env",
        rate_limit: { remaining: rateLimit.remaining }
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})