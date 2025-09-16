import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL, SUPABASE_ANON } from "@/config/publicConfig";

// Helper for calling Edge Functions with proper auth and absolute URLs
export async function callEF<T>(fnName: string, body?: Record<string, unknown>): Promise<T> {
  const supabaseUrl = SUPABASE_URL;
  const anonKey = SUPABASE_ANON;
  
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase configuration. Check SUPABASE_URL and SUPABASE_ANON configuration.');
  }

  // Ensure absolute URL to Supabase Functions
  const url = `${supabaseUrl}/functions/v1/${fnName}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Try to parse response as JSON safely
  let responseData: any = null;
  let isJsonResponse = false;
  
  const contentType = res.headers.get('content-type');
  
  if (contentType && contentType.includes('application/json')) {
    try {
      responseData = await res.json();
      isJsonResponse = true;
    } catch (parseError) {
      // JSON parsing failed, will handle as text below
      isJsonResponse = false;
    }
  }
  
  // If not JSON or parsing failed, get text response
  if (!isJsonResponse) {
    try {
      const textResponse = await res.text();
      responseData = textResponse;
    } catch (textError) {
      responseData = `Failed to read response: ${textError.message}`;
    }
  }

  // Handle error responses
  if (!res.ok) {
    // Extract correlation ID from headers or response
    const correlationId = res.headers.get('x-correlation-id') || 
                         res.headers.get('x-corr-id') || 
                         (isJsonResponse && (responseData?.corr || responseData?.correlationId));
    
    const errorInfo = {
      status: res.status,
      statusText: res.statusText,
      traceId: isJsonResponse && responseData?.traceId ? responseData.traceId : undefined,
      correlationId,
      originalPayload: responseData,
    };
    
    // Log the full error details for debugging
    console.error('Edge Function Error:', {
      function: fnName,
      url,
      requestBody: body,
      responseStatus: res.status,
      responseData,
      traceId: errorInfo.traceId,
    });
    
    // Create a structured error
    const errorMessage = isJsonResponse && responseData?.error 
      ? responseData.error 
      : isJsonResponse 
        ? `Edge Function returned ${res.status}: ${JSON.stringify(responseData)}`
        : `HTTP ${res.status}: ${typeof responseData === 'string' ? responseData.substring(0, 200) : res.statusText}`;
    
    const error = new Error(errorMessage);
    // Attach additional error info for components that need it
    (error as any).status = errorInfo.status;
    (error as any).traceId = errorInfo.traceId;
    (error as any).correlationId = errorInfo.correlationId;
    (error as any).originalPayload = errorInfo.originalPayload;
    
    throw error;
  }

  // Handle successful non-JSON responses
  if (!isJsonResponse) {
    const preview = typeof responseData === 'string' ? responseData.substring(0, 200) : String(responseData);
    throw new Error(`Expected JSON response but received: ${preview}${typeof responseData === 'string' && responseData.length > 200 ? '...' : ''}`);
  }

  // Return the parsed JSON data
  return responseData as T;
}

// Development helper to check for missing env vars
export function checkDevEnv(): { 
  hasAnonKey: boolean; 
  hasSupabaseUrl: boolean; 
  warning?: string; 
  isComplete: boolean;
} {
  const anonKey = SUPABASE_ANON;
  const supabaseUrl = SUPABASE_URL;
  
  const missing = [];
  if (!anonKey) missing.push('SUPABASE_ANON');
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  
  if (missing.length > 0 && (typeof window !== 'undefined')) {
    return {
      hasAnonKey: !!anonKey,
      hasSupabaseUrl: !!supabaseUrl,
      warning: `Missing environment variables: ${missing.join(', ')}. Edge Function calls will fail.`,
      isComplete: false
    };
  }
  
  return { 
    hasAnonKey: true, 
    hasSupabaseUrl: true,
    isComplete: true
  };
}