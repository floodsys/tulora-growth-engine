// Cloudflare Turnstile Configuration
// Get your site key from: https://dash.cloudflare.com/

// Cloudflare "always passes" test key — safe for local dev
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'

/**
 * Returns the Turnstile site key to use.
 *  1. VITE_TURNSTILE_SITE_KEY env var (preferred)
 *  2. Hardcoded production key (legacy fallback)
 *  3. In dev mode only, the Cloudflare "always passes" test key
 *  4. Empty string in production if nothing is configured (widget will show error)
 */
export function getTurnstileSiteKey(): string {
  const envKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
  if (envKey) return envKey

  const isDev =
    import.meta.env.DEV ||
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'))

  if (isDev) return TURNSTILE_TEST_SITE_KEY

  // Production fallback — previously hardcoded key
  return '0x4AAAAAAB0FhefvQFKq2-Fb'
}

// Re-export for backward compat with useTurnstile hook
export const TURNSTILE_SITE_KEY = getTurnstileSiteKey()
