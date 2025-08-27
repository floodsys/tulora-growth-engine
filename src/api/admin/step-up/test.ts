// API route for preview-only headless step-up test

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cookie',
  'Access-Control-Allow-Credentials': 'true',
};

export default async function handler(req: any, res: any) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    res.statusCode = 200;
    return res.end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  // Preview environment only
  const host = req.headers.host || '';
  if (!host.includes('lovable.app')) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 403;
    return res.end(JSON.stringify({
      error: 'Test endpoint only available in preview environment'
    }));
  }

  try {
    // Verify authentication (basic check)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'Authentication required' }));
    }

    // Set elevated admin session cookie
    const issuedAt = new Date().toISOString();
    const maxAge = 43200; // 12 hours in seconds
    const cookieValue = `${issuedAt}:test-user-id`;
    
    // Environment-aware domain
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const domain = isLocalhost ? undefined : '.lovable.app';
    
    const cookieOptions = [
      `Max-Age=${maxAge}`,
      'HttpOnly',
      isLocalhost ? undefined : 'Secure',
      'SameSite=Lax',
      'Path=/',
      domain ? `Domain=${domain}` : undefined
    ].filter(Boolean).join('; ');

    res.setHeader('Set-Cookie', `sa_issued=${cookieValue}; ${cookieOptions}`);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    
    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      test_mode: true,
      issued_at: issuedAt,
      expires_at: new Date(Date.now() + maxAge * 1000).toISOString(),
      cookie_attributes: {
        domain: domain || 'host-only',
        path: '/',
        sameSite: 'Lax',
        secure: !isLocalhost,
        httpOnly: true,
        environment: 'preview'
      }
    }));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: errorMessage }));
  }
}