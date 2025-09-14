/**
 * Centralized environment variable access for frontend
 * Mirrors the pattern used in Edge Functions
 */

export const getEnv = (key: string): string => {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const getOptionalEnv = (key: string): string | undefined => {
  return import.meta.env[key];
};

// Supabase configuration
export const SUPABASE_URL = (): string => getEnv("VITE_SUPABASE_URL");
export const SUPABASE_ANON_KEY = (): string => getEnv("VITE_SUPABASE_ANON_KEY");

// Optional configuration
export const SUPERADMINS_EMAILS = (): string | undefined => getOptionalEnv("VITE_SUPERADMINS_EMAILS");
export const RUN_TEST_LEVEL = (): string | undefined => getOptionalEnv("VITE_RUN_TEST_LEVEL");