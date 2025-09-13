// Environment-aware API key retrieval for edge functions
function getRetellApiKeyForEnv(): string {
  const hostname = globalThis?.location?.hostname || ''
  
  if (hostname.includes('localhost') || hostname.includes('staging') || hostname.includes('preview')) {
    return Deno.env.get('RETELL_API_KEY_DEV') || Deno.env.get('RETELL_API_KEY') || ''
  }
  
  return Deno.env.get('RETELL_API_KEY_PROD') || Deno.env.get('RETELL_API_KEY') || ''
}

function getRetellWebhookSecretForEnv(): string {
  const hostname = globalThis?.location?.hostname || ''
  
  if (hostname.includes('localhost') || hostname.includes('staging') || hostname.includes('preview')) {
    return Deno.env.get('RETELL_WEBHOOK_SECRET_DEV') || Deno.env.get('RETELL_WEBHOOK_SECRET') || ''
  }
  
  return Deno.env.get('RETELL_WEBHOOK_SECRET_PROD') || Deno.env.get('RETELL_WEBHOOK_SECRET') || ''
}

export { getRetellApiKeyForEnv, getRetellWebhookSecretForEnv }