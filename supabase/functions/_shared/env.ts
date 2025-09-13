/**
 * Centralized environment variable access for Edge Functions
 * Works in both Deno (Edge Functions) and Node.js environments
 */

export const getEnv = (key: string): string => {
  const value = Deno?.env?.get?.(key) ?? process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const getOptionalEnv = (key: string): string | undefined => {
  return Deno?.env?.get?.(key) ?? process.env[key];
};

// Retell API configuration
export const RETELL_API_KEY = (): string => getEnv("RETELL_API_KEY");
export const RETELL_WEBHOOK_SECRET = (): string => getEnv("RETELL_WEBHOOK_SECRET");

// Supabase configuration
export const SUPABASE_URL = (): string => getEnv("SUPABASE_URL");
export const SUPABASE_ANON_KEY = (): string => getEnv("SUPABASE_ANON_KEY");
export const SUPABASE_SERVICE_ROLE_KEY = (): string => getEnv("SUPABASE_SERVICE_ROLE_KEY");

// Stripe configuration
export const STRIPE_SECRET_KEY = (): string => getEnv("STRIPE_SECRET_KEY");
export const STRIPE_WEBHOOK_SECRET = (): string => getEnv("STRIPE_WEBHOOK_SECRET");

// Optional environment variables
export const STRIPE_PORTAL_RETURN_URL = (): string | undefined => getOptionalEnv("STRIPE_PORTAL_RETURN_URL");
export const VOICE_DEBUG_KEY = (): string | undefined => getOptionalEnv("VOICE_DEBUG_KEY");
export const CORS_ALLOWED_ORIGINS = (): string | undefined => getOptionalEnv("CORS_ALLOWED_ORIGINS");

// Retell URL configuration
export const RETELL_PHONE_CREATE_URL = (): string | undefined => getOptionalEnv("RETELL_PHONE_CREATE_URL");
export const RETELL_WEB_CREATE_URL = (): string | undefined => getOptionalEnv("RETELL_WEB_CREATE_URL");
export const RETELL_FROM_NUMBER = (): string | undefined => getOptionalEnv("RETELL_FROM_NUMBER");