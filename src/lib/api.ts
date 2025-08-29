import { supabase } from "@/integrations/supabase/client";

// Helper for calling Edge Functions with proper auth and absolute URLs
export async function callEF<T>(fnName: string, body?: Record<string, unknown>): Promise<T> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase configuration. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
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

  // Check if response is JSON before parsing
  const contentType = res.headers.get('content-type');
  
  if (!res.ok) {
    if (contentType && contentType.includes('application/json')) {
      const errorData = await res.json();
      throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
    } else {
      // Handle non-JSON responses (HTML error pages, etc.)
      const textResponse = await res.text();
      const preview = textResponse.substring(0, 200);
      throw new Error(`Received HTML/Non-JSON response (${res.status}): ${preview}${textResponse.length > 200 ? '...' : ''}`);
    }
  }

  // Ensure successful response is JSON
  if (!contentType || !contentType.includes('application/json')) {
    const textResponse = await res.text();
    const preview = textResponse.substring(0, 200);
    throw new Error(`Expected JSON response but received: ${preview}${textResponse.length > 200 ? '...' : ''}`);
  }

  try {
    return await res.json();
  } catch (parseError) {
    const textResponse = await res.text();
    const preview = textResponse.substring(0, 200);
    throw new Error(`Failed to parse JSON response: ${preview}${textResponse.length > 200 ? '...' : ''}`);
  }
}

// Development helper to check for missing env vars
export function checkDevEnv(): { 
  hasAnonKey: boolean; 
  hasSupabaseUrl: boolean; 
  warning?: string; 
  isComplete: boolean;
} {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  const missing = [];
  if (!anonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
  
  if (missing.length > 0 && import.meta.env.DEV) {
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