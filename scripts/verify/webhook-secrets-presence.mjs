#!/usr/bin/env node
/**
 * scripts/verify/webhook-secrets-presence.mjs
 *
 * Production readiness gate: verifies that the required webhook
 * signing secrets are present in the environment.
 *
 * Required secrets:
 *   STRIPE_WEBHOOK_SECRET   — Stripe endpoint signing secret (whsec_...)
 *   RETELL_WEBHOOK_SECRET   — Retell webhook HMAC secret / API key with webhook badge
 *
 * This check does NOT validate the secrets' values or attempt API calls.
 * It only ensures the variables are set, which is a prerequisite for
 * webhook signature verification to work at runtime.
 *
 * Exit codes:
 *   0 = PASS  (all secrets present)
 *   1 = FAIL  (unexpected error)
 *   2 = SKIP  (one or more secrets missing — blocks strict mode only)
 */

const REQUIRED_SECRETS = [
    {
        name: "STRIPE_WEBHOOK_SECRET",
        description: "Stripe endpoint signing secret (whsec_...)",
        prefixHint: "whsec_",
    },
    {
        name: "RETELL_WEBHOOK_SECRET",
        description: "Retell webhook HMAC signing secret",
        prefixHint: null,
    },
];

function redact(val) {
    if (!val) return "(unset)";
    if (val.length <= 8) return "***";
    return val.slice(0, 4) + "…" + val.slice(-4);
}

async function main() {
    console.log("\n🔐 Webhook Secrets Presence Check");
    console.log("─".repeat(50));

    let pass = 0;
    let fail = 0;

    for (const secret of REQUIRED_SECRETS) {
        const value = process.env[secret.name];
        const isSet = !!value && value.trim().length > 0;

        if (isSet) {
            // Optional: warn if prefix doesn't match expected pattern
            let prefixWarning = "";
            if (secret.prefixHint && !value.startsWith(secret.prefixHint)) {
                prefixWarning = ` ⚠ expected prefix "${secret.prefixHint}"`;
            }
            console.log(`  ✓ ${secret.name} = ${redact(value)}${prefixWarning}`);
            pass++;
        } else {
            console.log(`  ✗ ${secret.name} — NOT SET (${secret.description})`);
            fail++;
        }
    }

    console.log();
    console.log(`  Total: ${REQUIRED_SECRETS.length}  Present: ${pass}  Missing: ${fail}`);
    console.log();

    if (fail > 0) {
        console.log(
            "  ❌ Webhook secrets check FAILED. Webhook signature verification\n" +
            "     will not work without these secrets configured.\n"
        );
    } else {
        console.log("  ✅ All webhook signing secrets are configured.\n");
    }

    return { pass, fail, skip: 0, label: "webhook-secrets-presence" };
}

const result = await main();
// Exit 2 = SKIP: secrets are runtime Edge Function config, not always
// available locally. In strict mode (production readiness), SKIP → FAIL.
if (result.fail > 0) process.exit(2);
