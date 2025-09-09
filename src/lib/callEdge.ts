import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL!;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;
export const supabase = createClient(url, anon);

export async function callEdge<T=any>(name: string, body?: any) {
  const response = await supabase.functions.invoke<T>(name, { body });
  return { data: response.data, error: response.error, status: response.error ? 500 : 200 };
}