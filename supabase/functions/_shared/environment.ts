import { RETELL_API_KEY, RETELL_WEBHOOK_SECRET } from './env.ts';

// Environment-aware API key retrieval for edge functions
// Now uses centralized env access with simplified logic
function getRetellApiKeyForEnv(): string {
  return RETELL_API_KEY();
}

function getRetellWebhookSecretForEnv(): string {
  return RETELL_WEBHOOK_SECRET();
}

export { getRetellApiKeyForEnv, getRetellWebhookSecretForEnv }