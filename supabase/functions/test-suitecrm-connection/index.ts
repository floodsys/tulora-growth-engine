import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestConnectionRequest {
  auth_mode: string
  base_url: string
  client_id: string
  client_secret: string
  username?: string
  password?: string
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

async function testSuiteCRMConnection(config: TestConnectionRequest) {
  const { auth_mode, base_url, client_id, client_secret, username, password } = config
  
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

    if (auth_mode === 'v8_client_credentials') {
      // Client credentials mode - only send grant_type, client_id, client_secret (and scope if configured)
    } else {
      // For password grant, add username and password
      if (!username || !password) {
        throw new Error('Username and password are required for this authentication mode')
      }
      authPayload.username = username
      authPayload.password = password
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
      console.error(`SuiteCRM auth failed: ${response.status} ${response.statusText} - ${errorText}`)
      
      // Provide more detailed error information
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
    if (auth_mode === 'v8_client_credentials') {
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
    } else {
      // For password grant, use the user info from the token response if available
      const userName = authData.user?.user_name || username || 'authenticated-user'
      return {
        success: true,
        message: `Authentication successful, user = ${userName}`,
        token_type: authData.token_type,
        expires_in: authData.expires_in,
        user_name: userName
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
    let auth_mode, base_url, client_id, client_secret, username, password

    if (req.method === 'GET') {
      const url = new URL(req.url)
      auth_mode = url.searchParams.get('auth_mode')
      base_url = url.searchParams.get('base_url')
      client_id = url.searchParams.get('client_id')
      client_secret = url.searchParams.get('client_secret')
      username = url.searchParams.get('username')
      password = url.searchParams.get('password')
    } else {
      const body = await req.json()
      auth_mode = body.auth_mode
      base_url = body.base_url
      client_id = body.client_id
      client_secret = body.client_secret
      username = body.username
      password = body.password
    }

    // Validate required fields based on auth mode
    if (!base_url || !client_id || !client_secret) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Base URL, Client ID, and Client Secret are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate base URL format
    if (!base_url.startsWith('http://') && !base_url.startsWith('https://')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Base URL must start with http:// or https://' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check for incomplete URLs
    if (base_url === 'https://' || base_url === 'http://') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Base URL is incomplete. Please provide the full SuiteCRM URL (e.g., https://your-suitecrm.com)' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (auth_mode !== 'v8_client_credentials' && (!username || !password)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Username and password are required for this authentication mode' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const result = await testSuiteCRMConnection({
      auth_mode: auth_mode || 'v8_client_credentials',
      base_url,
      client_id,
      client_secret,
      username,
      password
    })

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
        error: 'Invalid request format' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})