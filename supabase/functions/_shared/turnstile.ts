interface TurnstileVerificationResult {
  ok: boolean
  error?: string
  code?: string
}

interface TurnstileResponse {
  success: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
}

export async function requireTurnstileIfPublic(req: Request): Promise<TurnstileVerificationResult> {
  // Check bypass headers first
  const headers = req.headers
  
  if (headers.get('x-admin-request') === '1' || 
      headers.get('x-internal-test') === '1' || 
      headers.get('x-service-call') === '1') {
    return { ok: true }
  }
  
  // Check if Turnstile is required
  const turnstileRequired = Deno.env.get('TURNSTILE_REQUIRED') !== 'false'
  if (!turnstileRequired) {
    return { ok: true }
  }
  
  // Detect browser-like requests
  const userAgent = headers.get('user-agent')
  const secChUa = headers.get('sec-ch-ua')
  const contentType = headers.get('content-type')
  const isBrowserLike = !!(secChUa || userAgent || contentType?.includes('application/x-www-form-urlencoded'))
  
  if (!isBrowserLike) {
    return { ok: true }
  }
  
  // Extract Turnstile token
  let turnstileToken: string | null = null
  
  try {
    if (contentType?.includes('application/json')) {
      const body = await req.clone().json()
      turnstileToken = body['cf-turnstile-response'] || body['turnstile_token']
    } else if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await req.clone().formData()
      turnstileToken = formData.get('cf-turnstile-response')?.toString() || 
                      formData.get('turnstile_token')?.toString() || null
    }
  } catch (error) {
    console.warn('Failed to parse request body for Turnstile token:', error)
  }
  
  if (!turnstileToken) {
    return {
      ok: false,
      error: "Turnstile verification required",
      code: "turnstile_missing"
    }
  }
  
  // Verify with Cloudflare
  const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secretKey) {
    console.warn('TURNSTILE_SECRET_KEY not configured')
    // Don't block if misconfigured - fail open for better UX
    return { ok: true }
  }
  
  try {
    const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: turnstileToken,
        remoteip: headers.get('cf-connecting-ip') || headers.get('x-forwarded-for') || '',
      }),
    })
    
    if (!verifyResponse.ok) {
      console.warn('Turnstile verification API error:', verifyResponse.status)
      // Fail open on API errors
      return { ok: true }
    }
    
    const result: TurnstileResponse = await verifyResponse.json()
    
    if (!result.success) {
      console.warn('Turnstile verification failed:', result['error-codes'])
      return {
        ok: false,
        error: "Turnstile verification failed",
        code: "turnstile_failed"
      }
    }
    
    return { ok: true }
    
  } catch (error) {
    console.warn('Turnstile verification error:', error)
    // Fail open on errors to avoid breaking legitimate users
    return { ok: true }
  }
}