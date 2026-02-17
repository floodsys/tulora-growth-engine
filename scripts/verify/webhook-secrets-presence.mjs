#!/usr/bin/env node
/**
 * scripts/verify/webhook-secrets-presence.mjs
 *
 * DEPRECATED — INFO-only check. Always exits with code 2 (SKIP).
 *
 * Webhook secrets (STRIPE_WEBHOOK_SECRET, RETELL_WEBHOOK_SECRET) are
 * runtime Edge Function configuration that cannot be read back from
 * Supabase. Requiring them locally is impossible for CI and most
 * developer machines.
 *
 * Signature enforcement is now verified by the companion script
 * `webhook-signature-enforcement.mjs`, which probes the deployed
 * endpoints and confirms they reject unsigned requests (4xx).
 *
 * This script is kept for backwards compatibility but will always SKIP.
 *
 * Exit codes:
 *   2 = SKIP  (always)
 */

const REQUIRED_SECRETS = [
    {
        name: "STRIPE_WEBHOOK_SECRET",
        description: "Stripe endpoint signing secret (whsec_...)",
    },
    {
        name: "RETELL_WEBHOOK_SECRET",
        description: "Retell webhook HMAC signing secret",
    },
];

async function main() {
    console.log("\n🔐 Webhook Secrets Presence Check (INFO-ONLY — deprecated)");
    console.log("─".repeat(50));
    console.log(
        "  ℹ This check is informational only and always SKIPs.\n" +
        "  ℹ Signature enforcement is verified by webhook-signature-enforcement.mjs.\n"
    );

    for (const secret of REQUIRED_SECRETS) {
        const value = process.env[secret.name];
        const isSet = !!value && value.trim().length > 0;
        if (isSet) {
            console.log(`  ✓ ${secret.name} = (set)`);
        } else {
            console.log(`  – ${secret.name} — not set (${secret.description})`);
        }
    }

    console.log();
    console.log("  ⏭ SKIP — this check is informational only.\n");

    return { pass: 0, fail: 0, skip: 1, label: "webhook-secrets-presence" };
}

const result = await main();
// Always SKIP — never block strict mode
process.exit(2);
