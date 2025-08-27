// API route to validate admin session (same-origin)
// This proxies to the Supabase edge function but runs on the same domain
import { supabase } from '@/integrations/supabase/client';

export async function validateAdminSession(request: Request): Promise<Response> {
  try {
    // Get the authorization header from the original request
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(JSON.stringify({
        valid: false,
        reason: 'No authorization header'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
    }

    // Call the Supabase edge function with the auth header and cookies
    const { data, error } = await supabase.functions.invoke('admin-step-up-auth', {
      body: { action: 'check_session' },
      headers: {
        'Authorization': authHeader,
        'Cookie': request.headers.get('Cookie') || ''
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      return new Response(JSON.stringify({
        valid: false,
        reason: 'Validation service error'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Validation error:', error);
    return new Response(JSON.stringify({
      valid: false,
      reason: 'Validation failed'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
  }
}

// Handle the request based on method
export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type, cookie',
        'Access-Control-Allow-Credentials': 'true'
      }
    });
  }

  if (request.method === 'POST') {
    return validateAdminSession(request);
  }

  return new Response('Method not allowed', { status: 405 });
}