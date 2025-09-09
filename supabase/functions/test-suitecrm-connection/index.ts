import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getSuiteCRMClient } from "../_shared/suitecrm.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const VERSION = "2025-09-08-2"

async function testSuiteCRMHealth() {
  const version = VERSION;
  
  try {
    const client = getSuiteCRMClient();
    const mode = client.getMode();
    const tokenStatus = client.checkToken();
    
    // Try a harmless API call to modules
    let apiStatus = { ok: false, status: null };
    
    try {
      const response = await client.crmFetch("modules", { method: "GET" });
      apiStatus = { 
        ok: response.ok, 
        status: response.status 
      };
    } catch (error) {
      // API call failed but we still report success if token is valid
      apiStatus = { 
        ok: false, 
        status: null 
      };
    }
    
    console.info("suitecrm.health", { mode, status: tokenStatus.ok ? "healthy" : "token_invalid" });
    
    if (tokenStatus.ok) {
      return {
        ok: true,
        mode,
        token: {
          seconds_left: tokenStatus.seconds_left
        },
        api: apiStatus,
        version
      };
    } else {
      return {
        ok: false,
        mode,
        error: tokenStatus.error || "Token validation failed",
        hint: "Check SUITECRM_BASE_URL, SUITECRM_CLIENT_ID, SUITECRM_CLIENT_SECRET",
        version
      };
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.info("suitecrm.health", { mode: "unknown", status: "error" });
    
    return {
      ok: false,
      mode: "client_credentials",
      error: errorMessage,
      hint: "Check SUITECRM_BASE_URL, SUITECRM_CLIENT_ID, SUITECRM_CLIENT_SECRET",
      version
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only accept GET requests
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: 'Method not allowed. Use GET only.',
        version: VERSION
      }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  try {
    const result = await testSuiteCRMHealth();
    
    const statusCode = result.ok ? 200 : 400;
    
    return new Response(
      JSON.stringify(result),
      { 
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Request processing error:', error)
    return new Response(
      JSON.stringify({ 
        ok: false, 
        mode: "client_credentials",
        error: 'Request processing failed',
        hint: "Check SUITECRM_BASE_URL, SUITECRM_CLIENT_ID, SUITECRM_CLIENT_SECRET",
        version: VERSION
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})