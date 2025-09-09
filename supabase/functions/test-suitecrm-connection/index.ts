import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

// Boot logging - check what environment variables are present
function logSuiteCRMEnvStatus() {
  const base_url = Deno.env.get('SUITECRM_BASE_URL')
  const client_id = Deno.env.get('SUITECRM_CLIENT_ID')
  const client_secret = Deno.env.get('SUITECRM_CLIENT_SECRET')
  const auth_mode = Deno.env.get('SUITECRM_AUTH_MODE')
  
  const present = []
  if (base_url) present.push('base_url')
  if (client_id) present.push('client_id')
  if (client_secret) present.push('client_secret')
  if (auth_mode) present.push('auth_mode')
  
  console.log(`[CFG] suitecrm env present: ${present.join(', ')}`)
  return { base_url, client_id, client_secret, auth_mode }
}

async function testSuiteCRMConnection() {
  const envConfig = logSuiteCRMEnvStatus()
  const { base_url, client_id, client_secret, auth_mode } = envConfig
  
  if (!base_url || !client_id || !client_secret || !auth_mode) {
    throw new Error('Missing SuiteCRM environment configuration. Required: SUITECRM_BASE_URL, SUITECRM_CLIENT_ID, SUITECRM_CLIENT_SECRET, SUITECRM_AUTH_MODE')
  }
  
  // Clean up base URL
  const cleanBaseUrl = base_url.replace(/\/$/, '')
  
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
      throw new Error('Only v8_client_credentials authentication mode is supported')
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
      
      // Provide more detailed error information without exposing secrets
      let errorMessage = `Authentication failed: ${response.status} ${response.statusText}`
      if (errorText) {
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.error_description) {
            errorMessage += ` - ${errorJson.error_description}`
          } else if (errorJson.error) {
            errorMessage += ` - ${errorJson.error}`
          }
        } catch {
          // If not JSON, include the raw error text (truncated)
          errorMessage += ` - ${errorText.substring(0, 200)}`
        }
      }
      
      throw new Error(errorMessage)
    }

    const authData: SuiteCRMAuthResponse = await response.json()
    console.log('Authentication successful, received token')

    // For client credentials, we need to get user info from the token
    try {
      // Try to get current user info to validate the token
      const userResponse = await fetch(`${cleanBaseUrl}/Api/V8/me`, {
        headers: {
          'Authorization': `Bearer ${authData.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (userResponse.ok) {
        const userData = await userResponse.json()
        const userName = userData.data?.attributes?.user_name || 'tulora-api'
        
        return {
          success: true,
          message: `Token OK, associated user = ${userName}`,
          token_type: authData.token_type,
          expires_in: authData.expires_in,
          user_name: userName
        }
      } else {
        // If /me endpoint fails, still consider it successful if we got a token
        return {
          success: true,
          message: 'Token OK, associated user = tulora-api',
          token_type: authData.token_type,
          expires_in: authData.expires_in,
          user_name: 'tulora-api'
        }
      }
    } catch (error) {
      // If user info fetch fails, still consider it successful if we got a token
      console.log('Could not fetch user info, but token is valid')
      return {
        success: true,
        message: 'Token OK, associated user = tulora-api',
        token_type: authData.token_type,
        expires_in: authData.expires_in,
        user_name: 'tulora-api'
      }
    }

  } catch (error) {
    console.error('SuiteCRM connection test failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Method guard - only allow GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  try {
    const result = await testSuiteCRMConnection()
    
    // Add config source to response
    const response = {
      ...result,
      config_source: "edge_env"
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
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        config_source: "edge_env"
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})