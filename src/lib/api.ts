import { supabase } from "@/integrations/supabase/client";

// Helper for calling Edge Functions with proper auth
export async function callEF<T>(fnName: string, body?: Record<string, unknown>): Promise<T> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!res.ok) {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const errorData = await res.json();
      throw new Error(JSON.stringify(errorData));
    } else {
      const errorText = await res.text();
      const preview = errorText.slice(0, 200);
      throw new Error(`Edge function returned non-JSON response (${res.status}): ${preview}${errorText.length > 200 ? '...' : ''}`);
    }
  }
  
  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const responseText = await res.text();
    const preview = responseText.slice(0, 200);
    throw new Error(`Expected JSON response but got: ${preview}${responseText.length > 200 ? '...' : ''}`);
  }
  
  return res.json();
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