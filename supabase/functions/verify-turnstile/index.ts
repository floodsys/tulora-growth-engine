import { getCorsHeaders } from '../_shared/cors.ts'

interface TurnstileVerifyRequest {
  token: string
  action?: string
  remoteip?: string
}

async function verifyTurnstile(token: string, remoteip?: string): Promise<boolean> {
  const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY')
  
  if (!secretKey) {
    console.error('TURNSTILE_SECRET_KEY not configured')
    return false
  }

  try {
    const formData = new FormData()
    formData.append('secret', secretKey)
    formData.append('response', token)
    if (remoteip) {
      formData.append('remoteip', remoteip)
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    })

    const result = await response.json()
    return result.success === true
  } catch (error) {
    console.error('Turnstile verification error:', error)
    return false
  }
}

// Domain allowlist for widgets
const getAllowedDomains = (): string[] => {
  const domainsEnv = Deno.env.get('ALLOWED_WIDGET_DOMAINS')
  if (!domainsEnv) {
    return ['localhost', '127.0.0.1'] // Default for development
  }
  return domainsEnv.split(',').map(d => d.trim().toLowerCase())
}

function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  
  if (!origin && !referer) {
    return false // Require origin or referer for widget requests
  }
  
  const allowedDomains = getAllowedDomains()
  const urlToCheck = origin || referer
  
  try {
    const url = new URL(urlToCheck!)
    const hostname = url.hostname.toLowerCase()
    
    return allowedDomains.some(domain => 
      hostname === domain || 
      hostname.endsWith('.' + domain) ||
      (domain === 'localhost' && (hostname === 'localhost' || hostname === '127.0.0.1'))
    )
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Enhanced CORS headers with CSP
  const enhancedCorsHeaders = {
    ...corsHeaders,
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; frame-ancestors 'self' https://*.lovable.app; connect-src 'self' https://*.supabase.co;",
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: enhancedCorsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...enhancedCorsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Validate origin for widget protection
    if (!validateOrigin(req)) {
      console.warn('Invalid origin for widget request:', req.headers.get('origin'))
      return new Response(
        JSON.stringify({ error: 'Origin not allowed' }),
        { status: 403, headers: { ...enhancedCorsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { token, action, remoteip }: TurnstileVerifyRequest = await req.json()

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing Turnstile token' }),
        { status: 400, headers: { ...enhancedCorsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract client IP from request
    const clientIP = remoteip || 
      req.headers.get('cf-connecting-ip') || 
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip')

    const isValid = await verifyTurnstile(token, clientIP)

    if (!isValid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Turnstile verification failed' 
        }),
        { status: 400, headers: { ...enhancedCorsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log successful verification for security monitoring
    console.log('Turnstile verification successful:', {
      action,
      clientIP,
      origin: req.headers.get('origin'),
      timestamp: new Date().toISOString()
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        verified_at: new Date().toISOString()
      }),
      { status: 200, headers: { ...enhancedCorsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error verifying Turnstile:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...enhancedCorsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})