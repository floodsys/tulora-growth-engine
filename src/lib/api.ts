import { supabase } from "@/integrations/supabase/client";

// Helper for calling Edge Functions with proper auth
export async function callEF<T>(fnName: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
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