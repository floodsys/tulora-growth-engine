#!/usr/bin/env node
/**
 * scripts/verify/run-all.mjs  —  "verify:beta" orchestrator
 *
 * Runs every verification script in sequence and prints a truthful summary.
 *
 * Statuses:
 *   PASS    — check ran and succeeded
 *   FAIL    — check ran and found a problem, OR script crashed / is missing
 *   SKIP    — check could not run because credentials are missing
 *   UNKNOWN — check ran but could not determine a result
 *
 * Exit code:
 *   Normal mode:  0 = no FAIL,  1 = any FAIL
 *   Strict mode:  0 = all PASS, 1 = any FAIL/SKIP/UNKNOWN
 *
 * Flags:
 *   --strict        enable strict mode
 *   VERIFY_STRICT=1 enable strict mode via env
 *
 * Usage:
 *   node scripts/verify/run-all.mjs
 *   node scripts/verify/run-all.mjs --strict
 *   VERIFY_STRICT=1 node scripts/verify/run-all.mjs
 *   npm run verify:beta
 *   npm run verify:beta:strict
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local into process.env (if present) ──────────────────────────
try {
    const envPath = join(__dirname, "..", "..", ".env.local");
    if (existsSync(envPath)) {
        const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
        for (const line of lines) {
            const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)/);
            if (m && !process.env[m[1]]) {
                let val = m[2].trim();
                if (
                    (val.startsWith('"') && val.endsWith('"')) ||
                    (val.startsWith("'") && val.endsWith("'"))
                )
                    val = val.slice(1, -1);
                process.env[m[1]] = val;
            }
        }
    }
} catch {
    /* .env.local not found or not readable — continue without it */
}
const strict =
    process.argv.includes("--strict") || process.env.VERIFY_STRICT === "1";

// ── exit-code-to-status mapping for child scripts ───────────────────────────
// Convention:  0=PASS  1=FAIL  2=SKIP  3=UNKNOWN
// Anything else (including crash / missing script) → FAIL
function exitCodeToStatus(code) {
    switch (code) {
        case 0:
            return "PASS";
        case 1:
            return "FAIL";
        case 2:
            return "SKIP";
        case 3:
            return "UNKNOWN";
        default:
            return "FAIL";
    }
}

// ── checks to run ───────────────────────────────────────────────────────────
const checks = [
    {
        label: "retell-webhook-config",
        script: join(__dirname, "retell-webhook-config.mjs"),
        requiredEnv: ["RETELL_API_KEY"],
    },
    {
        label: "stripe-webhook-endpoints",
        script: join(__dirname, "stripe-webhook-endpoints.mjs"),
        requiredEnv: ["STRIPE_SECRET_KEY"],
    },
    {
        label: "scheduler-check",
        script: join(__dirname, "scheduler-check.mjs"),
        requiredEnv: [], // degrades gracefully on its own
    },
    {
        label: "github-actions-permissions",
        script: join(__dirname, "github-actions-permissions.mjs"),
        requiredEnv: [], // degrades gracefully (gh CLI detection is internal)
    },
    {
        label: "webhook-secrets-presence",
        script: join(__dirname, "webhook-secrets-presence.mjs"),
        requiredEnv: [], // This check itself validates secret presence; no prereqs
    },
];

// ── run ─────────────────────────────────────────────────────────────────────
console.log("╔══════════════════════════════════════════════════╗");
console.log(
    strict
        ? "║     🚀  BETA READINESS VERIFICATION (STRICT)      ║"
        : "║        🚀  BETA READINESS VERIFICATION             ║"
);
console.log("╚══════════════════════════════════════════════════╝");
console.log();

const results = [];

for (const check of checks) {
    const divider = "═".repeat(50);
    console.log(`\n${divider}`);
    console.log(`▶ ${check.label}`);
    console.log(divider);

    // Guard: if the script file doesn't exist, it's a FAIL
    if (!existsSync(check.script)) {
        console.log(`  ✗ Script not found: ${check.script}`);
        results.push({ label: check.label, status: "FAIL" });
        continue;
    }

    // Guard: if required env vars are missing, mark SKIP (don't fake PASS)
    const missingEnv = check.requiredEnv.filter((v) => !process.env[v]);
    if (missingEnv.length > 0) {
        console.log(
            `  ⏭ SKIP — missing env: ${missingEnv.join(", ")}`
        );
        results.push({ label: check.label, status: "SKIP" });
        continue;
    }

    // Run the script
    try {
        execSync(`node "${check.script}"`, {
            stdio: "inherit",
            env: process.env,
            timeout: 60_000,
        });
        // exit code 0 → PASS
        results.push({ label: check.label, status: "PASS" });
    } catch (err) {
        const code = err.status ?? 1;
        const status = exitCodeToStatus(code);
        results.push({ label: check.label, status });
    }
}

// ── summary ─────────────────────────────────────────────────────────────────
console.log("\n");
console.log("╔══════════════════════════════════════════════════╗");
console.log("║               VERIFICATION SUMMARY               ║");
console.log("╚══════════════════════════════════════════════════╝");
console.log();

const icons = { PASS: "✓", FAIL: "✗", SKIP: "⏭", UNKNOWN: "?" };
const maxLabel = Math.max(...results.map((r) => r.label.length));

for (const r of results) {
    const icon = icons[r.status] || "?";
    console.log(`  ${icon} ${r.label.padEnd(maxLabel + 2)} ${r.status}`);
}

const counts = { PASS: 0, FAIL: 0, SKIP: 0, UNKNOWN: 0 };
for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;

console.log();
console.log(
    `  Total: ${results.length}  ` +
    `Pass: ${counts.PASS}  Fail: ${counts.FAIL}  ` +
    `Skip: ${counts.SKIP}  Unknown: ${counts.UNKNOWN}`
);
console.log();

if (strict) {
    // Strict: only all-PASS is success
    const nonPass = results.filter((r) => r.status !== "PASS").length;
    if (nonPass > 0) {
        console.log(
            `  ❌ Beta readiness check FAILED (strict mode: ${nonPass} non-PASS result(s)).\n`
        );
        process.exit(1);
    } else {
        console.log("  ✅ All beta readiness checks passed (strict).\n");
        process.exit(0);
    }
} else {
    // Normal: SKIP/UNKNOWN are tolerated, only FAIL causes non-zero exit
    if (counts.FAIL > 0) {
        console.log("  ❌ Beta readiness check FAILED.\n");
        process.exit(1);
    } else {
        const extra =
            counts.SKIP + counts.UNKNOWN > 0
                ? ` (${counts.SKIP} skipped, ${counts.UNKNOWN} unknown — run with --strict to enforce)`
                : "";
        console.log(`  ✅ All beta readiness checks passed${extra}.\n`);
        process.exit(0);
    }
}
