// API route for admin session validation

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

  // Only allow GET
  if (req.method !== 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  try {
    // Set response headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Cookie');
    
    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.statusCode = 200;
      return res.end(JSON.stringify({
        valid: false,
        reason: 'No authorization header',
        cookie_present: false
      }));
    }

    // Parse cookies
    const cookieHeader = req.headers.cookie;
    const cookies = new Map();
    
    // Debug: log the received cookie header
    console.log('Received cookie header:', cookieHeader);
    
    if (cookieHeader) {
      cookieHeader.split(';').forEach((cookie: string) => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          cookies.set(name, value);
          console.log('Parsed cookie:', name, '=', value);
        }
      });
    }

    const saIssued = cookies.get('sa_issued');
    console.log('Looking for sa_issued cookie, found:', saIssued);
    
    if (!saIssued) {
      res.statusCode = 200;
      return res.end(JSON.stringify({
        valid: false,
        reason: 'No elevated session cookie found',
        cookie_present: false
      }));
    }

    const [issuedAtStr, cookieUserId] = saIssued.split(':');
    
    if (!issuedAtStr || !cookieUserId) {
      res.statusCode = 200;
      return res.end(JSON.stringify({
        valid: false,
        reason: 'Invalid cookie format',
        cookie_present: true
      }));
    }

    const issuedAt = new Date(issuedAtStr);
    const now = new Date();
    const ageSeconds = Math.floor((now.getTime() - issuedAt.getTime()) / 1000);
    const maxAgeSeconds = 43200; // 12 hours in seconds
    
    const valid = ageSeconds <= maxAgeSeconds;

    res.statusCode = 200;
    return res.end(JSON.stringify({
      cookie_present: true,
      session_age_sec: ageSeconds,
      ttl_sec: Math.max(0, maxAgeSeconds - ageSeconds),
      outcome: valid ? 'valid' : 'expired',
      valid,
      issued_at: issuedAtStr,
      age_sec: ageSeconds,
      max_age_sec: maxAgeSeconds,
      reason: valid ? 'Valid session' : 'Session expired'
    }));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    return res.end(JSON.stringify({
      valid: false,
      reason: 'Validation failed',
      error: errorMessage,
      cookie_present: false
    }));
  }
}