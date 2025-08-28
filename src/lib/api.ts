import { supabase } from "@/integrations/supabase/client";

// Helper for calling Edge Functions with proper auth
export async function callEF<T>(fnName: string, body?: any): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fnName, {
    body,
  });
  
  if (error) {
    throw new Error(`Edge Function ${fnName} error: ${error.message}`);
  }
  
  return data as T;
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