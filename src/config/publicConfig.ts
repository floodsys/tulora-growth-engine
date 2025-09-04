// Public config for frontend; no server secrets here.

// Supabase configuration
export const SUPABASE_URL = "https://nkjxbeypbiclvouqfjyc.supabase.co";
export const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ranhiZXlwYmljbHZvdXFmanljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0Nzg2NDEsImV4cCI6MjA3MTA1NDY0MX0.iuFFcJSX97MKkiBvSYLmIao9aTMrQm7zqnf4kEDraQg";

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