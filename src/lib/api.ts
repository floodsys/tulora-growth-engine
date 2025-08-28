import { supabase } from "@/integrations/supabase/client";
import { updateLastCallInfo } from "@/components/ui/DiagnosticsBar";

// Helper for calling Edge Functions with proper auth - LOCKED TO SUPABASE ONLY
export async function callEF<T>(fnName: string, body?: Record<string, unknown>): Promise<T> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  // Force absolute URL to Supabase Edge Functions only
  const functionUrl = `${supabaseUrl}/functions/v1/${fnName}`;
  
  const res = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  // Always check content-type first to avoid JSON parsing errors
  const contentType = res.headers.get('content-type') || '';
  const isJsonResponse = contentType.includes('application/json');
  
  if (!res.ok) {
    let traceId: string | undefined;
    
    if (isJsonResponse) {
      try {
        const errorData = await res.json();
        traceId = errorData.traceId;
        updateLastCallInfo({ status: res.status, parsed: true, traceId });
        throw new Error(JSON.stringify(errorData));
      } catch (jsonError) {
        // If JSON parsing fails, fall back to text
        const errorText = await res.text();
        const preview = errorText.slice(0, 200);
        updateLastCallInfo({ status: res.status, parsed: false });
        throw new Error(`Edge function error (${res.status}): ${preview}${errorText.length > 200 ? '...' : ''}`);
      }
    } else {
      const errorText = await res.text();
      const preview = errorText.slice(0, 200);
      updateLastCallInfo({ status: res.status, parsed: false });
      
      // Provide helpful error messages for common HTML responses
      if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
        throw new Error(`Received HTML instead of JSON (${res.status}). This usually means the function doesn't exist or there's a routing issue. Preview: ${preview}${errorText.length > 200 ? '...' : ''}`);
      } else if (errorText.includes('502 Bad Gateway') || errorText.includes('503 Service')) {
        throw new Error(`Service temporarily unavailable (${res.status}). Please try again. Preview: ${preview}${errorText.length > 200 ? '...' : ''}`);
      } else {
        throw new Error(`Edge function returned non-JSON response (${res.status}): ${preview}${errorText.length > 200 ? '...' : ''}`);
      }
    }
  }
  
  // Success response - ensure it's JSON
  if (!isJsonResponse) {
    const responseText = await res.text();
    const preview = responseText.slice(0, 200);
    updateLastCallInfo({ status: res.status, parsed: false });
    throw new Error(`Expected JSON response but got ${contentType || 'unknown content type'}. Preview: ${preview}${responseText.length > 200 ? '...' : ''}`);
  }

  try {
    const jsonResponse = await res.json();
    updateLastCallInfo({ 
      status: res.status, 
      parsed: true, 
      traceId: jsonResponse.traceId 
    });
    
    return jsonResponse;
  } catch (jsonError) {
    // Even with JSON content-type, parsing might fail
    const responseText = await res.text();
    const preview = responseText.slice(0, 200);
    updateLastCallInfo({ status: res.status, parsed: false });
    throw new Error(`Failed to parse JSON response. Preview: ${preview}${responseText.length > 200 ? '...' : ''}`);
  }
}

// Development helper to check for missing env vars
export function checkDevEnv(): { hasAnonKey: boolean; warning?: string } {
  // In production, this will be replaced by Vite
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!anonKey && import.meta.env.DEV) {
    return {
      hasAnonKey: false,
      warning: "Missing VITE_SUPABASE_ANON_KEY — Edge Function calls will 401."
    };
  }
  
  return { hasAnonKey: true };
}