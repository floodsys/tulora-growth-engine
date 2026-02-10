// Public config for frontend; no server secrets here.

// Supabase configuration – values come from env; the anon key is a *public* publishable key.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://nkjxbeypbiclvouqfjyc.supabase.co";
export const SUPABASE_ANON: string = import.meta.env.VITE_SUPABASE_ANON_KEY || ""; // set VITE_SUPABASE_ANON_KEY in env

// Application URL
export const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080';

// Agent phone numbers for UI display
export const JESSICA_PHONE = "+1 (863) 451-9425";
export const PAUL_PHONE = "+1 (289) 907-2070";
export const LAURA_PHONE = "+1 (289) 536-8131";

// Feature flags for agent capabilities
export const JESSICA_CALL = true;
export const JESSICA_WEB = true;
export const PAUL_CALL = true;
export const PAUL_WEB = true;
export const LAURA_CALL = true;
export const LAURA_WEB = true;