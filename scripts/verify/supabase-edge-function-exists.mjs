#!/usr/bin/env node
/**
 * scripts/verify/supabase-edge-function-exists.mjs
 *
 * Verifies that critical Supabase Edge Functions exist in production
 * by probing their URLs and confirming they do NOT return 404.
 *
 * Supabase Edge Functions require JWT by default, so 401/400/405 are
 * acceptable "exists" responses — they prove the function is deployed.
 * A 404 means the function is missing (the drift condition we guard against).
 *
 * Functions checked:
 *   - org-invitations-accept
 *
 * Exit codes:
 *   0 = PASS  (all functions respond with non-404)
 *   1 = FAIL  (any function returned 404 or network error)
 *   2 = SKIP  (SUPABASE_URL not set)
 */

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/**
 * Redact a URL for safe logging — strips path segments that might leak info.
 * Keeps the host visible but masks anything after /functions/v1/.
 *
 * @param {string} url
 * @returns {string}
 */
function redactUrl(url) {
    try {
        const u = new URL(url);
        return `${u.protocol}//${u.host}/functions/v1/***`;
    } catch {
        return "<invalid-url>";
    }
}

/**
 * Probe a single Edge Function URL with a lightweight HEAD-like GET.
 *
 * @param {string} url   - Full function URL
 * @param {string} label - Human-readable label for logging
 * @returns {Promise<{ label: string, status: number, verdict: string, reason: string }>}
 */
async function probeFunction(url, label) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
            signal: controller.signal,
        });

        clearTimeout(timeout);
        const status = res.status;

        if (status === 404) {
            return {
                label,
                status,
                verdict: "FAIL",
                reason: `404 Not Found — function is NOT deployed`,
            };
        }

        // 200, 401, 400, 405, or any other non-404 → function exists
        if (status === 200 || status === 401 || status === 400 || status === 405) {
            return {
                label,
                status,
                verdict: "PASS",
                reason: `HTTP ${status} — function exists (deployed)`,
            };
        }

        // Any other status: function exists but unexpected response
        // Still counts as PASS (function is deployed), unless it's a 5xx
        if (status >= 500) {
            return {
                label,
                status,
                verdict: "PASS",
                reason: `HTTP ${status} — function exists (server error, but deployed)`,
            };
        }

        return {
            label,
            status,
            verdict: "PASS",
            reason: `HTTP ${status} — function exists`,
        };
    } catch (err) {
        const message = err && err.name === "AbortError"
            ? "Request timed out after 15s"
            : `Network/DNS error: ${err.message || err}`;
        return {
            label,
            status: 0,
            verdict: "FAIL",
            reason: message,
        };
    }
}

async function main() {
    const supabaseUrl = process.env.SUPABASE_URL;

    console.log("\n🔍 Supabase Edge Function Exists Check");
    console.log("─".repeat(50));

    if (!supabaseUrl) {
        console.log("  ⏭ SKIP — SUPABASE_URL not set\n");
        return { pass: 0, fail: 0, skip: 1 };
    }

    // Normalize: strip trailing slash
    const base = supabaseUrl.replace(/\/+$/, "");

    // ── Critical Edge Functions to verify ──────────────────────────────────
    const functions = [
        {
            name: "org-invitations-accept",
            url: `${base}/functions/v1/org-invitations-accept`,
        },
    ];

    let pass = 0;
    let fail = 0;

    for (const fn of functions) {
        console.log(`\n  Probing ${fn.name}...`);
        console.log(`    URL: ${redactUrl(fn.url)}`);

        const result = await probeFunction(fn.url, fn.name);

        if (result.verdict === "PASS") {
            console.log(`    ✓ ${result.reason}`);
            pass++;
        } else {
            console.log(`    ✗ ${result.reason}`);
            fail++;
        }
    }

    console.log();
    console.log(`  Total: ${functions.length}  Pass: ${pass}  Fail: ${fail}`);
    console.log();

    if (fail > 0) {
        console.log(
            "  ❌ Edge Function exists check FAILED.\n" +
            "     One or more critical Edge Functions returned 404 or were unreachable.\n" +
            "     This indicates production drift — the function must be deployed.\n"
        );
    } else {
        console.log("  ✅ All critical Edge Functions are deployed and reachable.\n");
    }

    return { pass, fail, skip: 0 };
}

// Only run CLI when executed directly (not when imported for testing)
const __filename = fileURLToPath(import.meta.url);
const isDirectExecution =
    process.argv[1] && resolve(process.argv[1]) === __filename;

if (isDirectExecution) {
    const result = await main();
    if (result.skip > 0) process.exit(2);
    if (result.fail > 0) process.exit(1);
    process.exit(0);
}

export { main, probeFunction };
