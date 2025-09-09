import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseAnon);

export async function callEdge<T=any>(name: string, body?: any) {
  const response = await supabase.functions.invoke<T>(name, { body });
  return { data: response.data, error: response.error, status: response.error ? 500 : 200 };
}