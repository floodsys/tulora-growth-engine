// Simple ping endpoint to test API routing

export default async function handler(req: any, res: any) {
  // Set no-cache headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Server-Runtime', 'api-handler');
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type, cookie');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  res.statusCode = 200;
  return res.end(JSON.stringify({ 
    ok: true, 
    runtime: 'api-handler',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  }));
}