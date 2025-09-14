// Cloudflare Turnstile Configuration
// Get your site key from: https://dash.cloudflare.com/

export const TURNSTILE_SITE_KEY = '0x4AAAAAAB0FhefvQFKq2-Fb'; // Replace with your actual site key

// Production configuration - replace with your real site key in production.
// Visit https://developers.cloudflare.com/turnstile/get-started/ for setup instructions.

export const getTurnstileSiteKey = (): string => {
  const hostname = window?.location?.hostname || ''
  
  // Use demo key for localhost/development
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return '1x00000000000000000000AA' // Demo key for testing
  }
  
  // Use production key for live domains
  return TURNSTILE_SITE_KEY
}