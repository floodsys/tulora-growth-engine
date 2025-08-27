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
    console.log('Test endpoint called, host:', host, 'method:', req.method);
    
    // Verify authentication (basic check)
    const authHeader = req.headers.authorization;
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'Authentication required' }));
    }

    // Set elevated admin session cookie with environment-aware domain
    const issuedAt = new Date().toISOString();
    const maxAge = 43200; // 12 hours in seconds
    const cookieValue = `${issuedAt}:test-user-id`;
    
    // Environment-aware domain detection
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const isProd = host.includes('tulora.io');
    const isPreview = host.includes('lovable.app');
    
    let domain;
    if (isLocalhost) {
      domain = undefined; // Host-only for localhost
    } else if (isProd) {
      domain = '.tulora.io';
    } else if (isPreview) {
      domain = '.lovable.app';
    } else {
      domain = undefined; // Fallback to host-only
    }
    
    // Clear any old cookies with wrong domain/path before setting new one
    const clearCookies = [
      // Clear host-only cookies that might shadow domain cookies
      `sa_issued=; Max-Age=0; Path=/; HttpOnly`,
      // Clear wrong path cookies
      `sa_issued=; Max-Age=0; Path=/admin; HttpOnly`,
      // Clear other environment domains  
      `sa_issued=; Max-Age=0; Path=/; Domain=.lovable.app; HttpOnly`,
      `sa_issued=; Max-Age=0; Path=/; Domain=.tulora.io; HttpOnly`
    ];
    
    const cookieOptions = [
      `Max-Age=${maxAge}`,
      'HttpOnly',
      !isLocalhost ? 'Secure' : undefined,
      'SameSite=Lax',
      'Path=/',
      domain ? `Domain=${domain}` : undefined
    ].filter(Boolean).join('; ');

    // Set clearing cookies first, then the main cookie
    const allCookies = [...clearCookies, `sa_issued=${cookieValue}; ${cookieOptions}`];
    console.log('Setting cookies:', allCookies);
    
    res.setHeader('Set-Cookie', allCookies);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Cookie');
    
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
        environment: isProd ? 'production' : (isPreview ? 'preview' : 'localhost'),
        host: host,
        cleared_old_cookies: clearCookies.length,
        cookie_set: `sa_issued=${cookieValue}; ${cookieOptions}`
      }
    }));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: errorMessage }));
  }
}