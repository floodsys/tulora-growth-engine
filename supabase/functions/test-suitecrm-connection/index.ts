import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const VERSION = "2025-09-09-v8-production"

// CORS Configuration - identical to contact-sales
const getAllowedOrigins = () => {
  const envOrigins = Deno.env.get('ALLOWED_ORIGINS') || '';
  const fallbackOrigins = [
    'https://lovable.dev',
    'https://preview--tulora-growth-engine.lovable.app',
    'https://tulora-growth-engine.lovable.app',
    'https://82f60040-b989-4e09-8aaf-a5888522b1a2.lovableproject.com',
    'https://id-preview--82f60040-b989-4e09-8aaf-a5888522b1a2.lovable.app',
    'https://82f60040-b989-4e09-8aaf-a5888522b1a2.sandbox.lovable.dev',
    'http://localhost:8080'
  ];

  return envOrigins ? envOrigins.split(',').map(origin => origin.trim()) : fallbackOrigins;
};

const getOriginSpecificHeaders = (requestOrigin: string | null) => {
  const allowedOrigins = getAllowedOrigins();

  // Check if the origin is allowed
  const allowedOrigin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0]; // fallback to first allowed origin

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, cache-control',
    'Access-Control-Expose-Headers': 'X-Function, X-Version, X-CRM-Status'
  };
};

const preflightHeaders = (requestOrigin: string | null) => {
  return {
    ...getOriginSpecificHeaders(requestOrigin),
    'Access-Control-Max-Age': '600',
    'Content-Length': '0'
  };
};

const createResponse = (data: any, status: number = 200, requestOrigin: string | null = null, crmStatus?: string) => {
  const headers = {
    'Content-Type': 'application/json',
    'X-Function': 'test-suitecrm-connection',
    'X-Version': VERSION,
    ...getOriginSpecificHeaders(requestOrigin)
  };

  if (crmStatus) {
    headers['X-CRM-Status'] = crmStatus;
  }

  return new Response(JSON.stringify(data), {
    status,
    headers
  });
};

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

    console.log(`[CRM] authenticate ${cleanBaseUrl}/Api/access_token`)

    const response = await fetch(`${cleanBaseUrl}/Api/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(authPayload)
    })

    console.log(`[CRM] authenticate ${cleanBaseUrl}/Api/access_token -> ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      // Scrub any potential secrets from error messages
      const scrubbed_error = errorText.substring(0, 100).replace(/[a-zA-Z0-9+/=]{20,}/g, '[REDACTED]')
      console.error(`[CRM] auth failed ${response.status}: ${scrubbed_error}`)

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
          errorMessage += ` - ${scrubbed_error}`
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

    // Test module endpoint after getting token
    let moduleEndpointStatus = 'unknown'
    try {
      // Try primary endpoint first
      const primaryModuleResponse = await fetch(`${cleanBaseUrl}/legacy/Api/V8/meta/modules`, {
        headers: {
          'Authorization': `Bearer ${authData.access_token}`,
          'Accept': 'application/vnd.api+json'
        }
      })

      if (primaryModuleResponse.ok) {
        moduleEndpointStatus = 'legacy-ok'
      } else {
        // Try fallback endpoint
        const fallbackModuleResponse = await fetch(`${cleanBaseUrl}/Api/V8/meta/modules`, {
          headers: {
            'Authorization': `Bearer ${authData.access_token}`,
            'Accept': 'application/vnd.api+json'
          }
        })

        moduleEndpointStatus = fallbackModuleResponse.ok ? 'fallback-ok' : 'both-failed'
      }
    } catch (error) {
      moduleEndpointStatus = 'error'
    }

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
        module_endpoint_status: moduleEndpointStatus,
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
        module_endpoint_status: moduleEndpointStatus,
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

const checkSuperadmin = async (request: Request) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.substring(7);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return { valid: false, error: 'Invalid token or user not found' };
    }

    const { data: isSuperadmin, error: superadminError } = await supabase
      .rpc('is_superadmin', { user_id: user.id });

    if (superadminError) {
      return { valid: false, error: `Superadmin check failed: ${superadminError.message}` };
    }

    if (!isSuperadmin) {
      return { valid: false, error: 'User is not a superadmin' };
    }

    return { valid: true, user };
  } catch (error) {
    return { valid: false, error: `Authentication error: ${error.message}` };
  }
};

serve(async (req) => {
  const requestOrigin = req.headers.get('origin');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: preflightHeaders(requestOrigin)
    });
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return createResponse(
      { success: false, error: 'Method not allowed' },
      405,
      requestOrigin
    );
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  if (!checkRateLimit(clientIP)) {
    return createResponse(
      { success: false, error: 'Rate limit exceeded' },
      429,
      requestOrigin
    );
  }

  // Check superadmin authentication
  const authCheck = await checkSuperadmin(req);
  if (!authCheck.valid) {
    return createResponse(
      { success: false, error: authCheck.error },
      403,
      requestOrigin
    );
  }

  try {
    const result = await testSuiteCRMConnection();
    const crmStatus = result.success ? 'connected' : 'failed';

    return createResponse(
      {
        ...result,
        version: VERSION,
        timestamp: new Date().toISOString()
      },
      200,
      requestOrigin,
      crmStatus
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return createResponse(
      {
        success: false,
        error: 'Internal server error',
        version: VERSION
      },
      500,
      requestOrigin,
      'error'
    );
  }
})