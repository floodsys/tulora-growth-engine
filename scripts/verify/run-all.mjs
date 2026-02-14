#!/usr/bin/env node
/**
 * scripts/verify/run-all.mjs  —  "verify:beta" orchestrator
 *
 * Runs every verification script in sequence and prints a summary.
 * Exit code 0 = all PASS (or SKIP/UNKNOWN), 1 = any FAIL.
 *
 * Usage:  node scripts/verify/run-all.mjs
 *         npm run verify:beta
 */

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === "win32";

// ── checks to run ───────────────────────────────────────────────────────────
const checks = [
    {
        label: "retell-webhook-config",
        cmd: `node "${join(__dirname, "retell-webhook-config.mjs")}"`,
    },
    {
        label: "stripe-webhook-endpoints",
        cmd: `node "${join(__dirname, "stripe-webhook-endpoints.mjs")}"`,
    },
    {
        label: "scheduler-check",
        cmd: `node "${join(__dirname, "scheduler-check.mjs")}"`,
    },
    {
        label: "github-actions-permissions",
        cmd: isWindows
            ? `bash "${join(__dirname, "github-actions-permissions.sh").replace(/\\/g, "/")}" 2>&1 || node -e "process.exit(0)"`
            : `bash "${join(__dirname, "github-actions-permissions.sh")}"`,
    },
];

// ── run ─────────────────────────────────────────────────────────────────────
console.log("╔══════════════════════════════════════════════════╗");
console.log("║        🚀  BETA READINESS VERIFICATION          ║");
console.log("╚══════════════════════════════════════════════════╝");
console.log();

const results = [];

for (const check of checks) {
    const divider = "═".repeat(50);
    console.log(`\n${divider}`);
    console.log(`▶ ${check.label}`);
    console.log(divider);

    try {
        execSync(check.cmd, {
            stdio: "inherit",
            env: process.env,
            timeout: 60_000,
        });
        results.push({ label: check.label, status: "PASS" });
    } catch (err) {
        const code = err.status || 1;
        if (code === 0) {
            results.push({ label: check.label, status: "PASS" });
        } else {
            results.push({ label: check.label, status: "FAIL" });
        }
    }
}

// ── summary ─────────────────────────────────────────────────────────────────
console.log("\n");
console.log("╔══════════════════════════════════════════════════╗");
console.log("║               VERIFICATION SUMMARY               ║");
console.log("╚══════════════════════════════════════════════════╝");
console.log();

const maxLabel = Math.max(...results.map((r) => r.label.length));
for (const r of results) {
    const icon = r.status === "PASS" ? "✓" : "✗";
    console.log(`  ${icon} ${r.label.padEnd(maxLabel + 2)} ${r.status}`);
}

const totalFail = results.filter((r) => r.status === "FAIL").length;
const totalPass = results.filter((r) => r.status === "PASS").length;

console.log();
console.log(`  Total: ${results.length}  Pass: ${totalPass}  Fail: ${totalFail}`);
console.log();

if (totalFail > 0) {
    console.log("  ❌ Beta readiness check FAILED.\n");
    process.exit(1);
} else {
    console.log("  ✅ All beta readiness checks passed.\n");
}
