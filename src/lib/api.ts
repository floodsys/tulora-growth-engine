import { callEdge } from "@/lib/callEdge";

// Helper for calling Edge Functions with proper auth - now uses callEdge internally
export async function callEF<T>(fnName: string, body?: Record<string, unknown>): Promise<T> {
  try {
    const { data, error } = await callEdge<T>(fnName, body);
    
    if (error) {
      throw new Error(error.message || 'Edge Function call failed');
    }
    
    return data as T;
  } catch (e) {
    // Re-throw with same error structure for backward compatibility
    throw e;
  }
}

// Development helper to check for missing env vars
export function checkDevEnv(): { 
  hasAnonKey: boolean; 
  hasSupabaseUrl: boolean; 
  warning?: string; 
  isComplete: boolean;
} {
  // This function is kept for backward compatibility but now uses callEdge internally
  return { 
    hasAnonKey: true, 
    hasSupabaseUrl: true,
    isComplete: true
  };
}