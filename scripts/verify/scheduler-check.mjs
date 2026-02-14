#!/usr/bin/env node
/**
 * scripts/verify/scheduler-check.mjs
 *
 * Checks whether retention-cleanup / usage-rollup scheduled jobs are present.
 * Queries the Supabase database via the REST API to detect pg_cron jobs.
 * If pg_cron is not installed or not accessible, reports UNKNOWN with follow-up.
 *
 * Env vars:
 *   SUPABASE_URL             – project URL
 *   SUPABASE_SERVICE_ROLE_KEY – service role for DB access (never printed)
 *   DATABASE_URL              – direct Postgres connection (fallback, optional)
 *
 * Exit codes:
 *   0 = PASS
 *   1 = FAIL
 *   2 = SKIP
 *   3 = UNKNOWN
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

function redact(key) {
    if (!key) return "(unset)";
    return key.slice(0, 4) + "…" + key.slice(-4);
}

async function main() {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const DATABASE_URL = process.env.DATABASE_URL;

    console.log("\n🔍 Scheduler / Cron Jobs Verification");
    console.log("─".repeat(50));
    console.log(`  SUPABASE_URL   : ${SUPABASE_URL || "(unset)"}`);
    console.log(`  SERVICE_ROLE   : ${redact(SUPABASE_SERVICE_ROLE_KEY)}`);
    console.log(`  DATABASE_URL   : ${DATABASE_URL ? "(set)" : "(unset)"}`);
    console.log();

    // ── Strategy 1: Query via Supabase RPC (PostgREST) ──
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        try {
            // Check if pg_cron extension exists
            const extRes = await fetch(
                `${SUPABASE_URL}/rest/v1/rpc/`,
                {
                    method: "POST",
                    headers: {
                        apikey: SUPABASE_SERVICE_ROLE_KEY,
                        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                        "Content-Type": "application/json",
                        Prefer: "return=representation",
                    },
                    // We can't directly query cron.job via PostgREST,
                    // so we'll use a raw SQL approach via psql if available
                }
            );
            // PostgREST doesn't expose cron schema by default
        } catch {
            // Ignore - fall through to psql
        }
    }

    // ── Strategy 2: Direct psql (if DATABASE_URL or local psql available) ──
    if (DATABASE_URL) {
        try {
            const __dirname = dirname(fileURLToPath(import.meta.url));
            const sqlPath = join(__dirname, "scheduler-check.sql");

            const output = execSync(`psql "${DATABASE_URL}" -f "${sqlPath}" 2>&1`, {
                encoding: "utf8",
                timeout: 15000,
            });

            console.log("  psql output:");
            console.log(output.split("\n").map((l) => `    ${l}`).join("\n"));

            // Parse results
            const hasCronJobs = output.includes("pg_cron") && !output.includes("0 rows");
            const pgCronInstalled = output.includes("pg_cron extension is installed");

            if (pgCronInstalled && hasCronJobs) {
                console.log("  ✓ Scheduled jobs found via pg_cron.");
                return { pass: 1, fail: 0, skip: 0, label: "scheduler-check" };
            } else if (pgCronInstalled) {
                console.log("  ⚠ pg_cron is installed but no retention/rollup jobs found.");
                console.log("  Follow-up: SELECT * FROM cron.job;");
                return { pass: 0, fail: 1, skip: 0, label: "scheduler-check" };
            } else {
                console.log("  ℹ pg_cron is not installed.");
            }
        } catch (err) {
            console.warn(`  ⚠ psql failed: ${err.message?.split("\n")[0]}`);
        }
    }

    // ── Strategy 3: Check for Supabase scheduled functions (edge functions with cron) ──
    // Supabase allows scheduling via supabase/config.toml [functions.<name>.schedule]
    try {
        const __dirname = dirname(fileURLToPath(import.meta.url));
        const configPath = join(__dirname, "..", "..", "supabase", "config.toml");
        const config = readFileSync(configPath, "utf8");

        const scheduleMatches = config.match(/\[functions\.[^\]]+\][\s\S]*?schedule\s*=\s*"[^"]+"/g);
        if (scheduleMatches && scheduleMatches.length > 0) {
            console.log(`  Found ${scheduleMatches.length} scheduled function(s) in supabase/config.toml:`);
            for (const m of scheduleMatches) {
                console.log(`    ${m.replace(/\n/g, " ").trim()}`);
            }
            return { pass: 1, fail: 0, skip: 0, label: "scheduler-check" };
        } else {
            console.log("  No scheduled functions found in supabase/config.toml.");
        }
    } catch {
        console.log("  Could not read supabase/config.toml.");
    }

    // ── Fallback: UNKNOWN ──
    console.log();
    console.log("  ⚠ UNKNOWN — Could not determine scheduler status.");
    console.log("  Follow-up commands:");
    console.log("    # If using pg_cron (requires direct DB access):");
    console.log("    psql $DATABASE_URL -c \"SELECT * FROM cron.job;\"");
    console.log();
    console.log("    # If using Supabase scheduled functions:");
    console.log("    supabase functions list");
    console.log();
    console.log("    # If using external scheduler (e.g., Cloud Scheduler, GitHub Actions cron):");
    console.log("    Check the relevant dashboard or config manually.");
    console.log();

    return { pass: 0, fail: 0, skip: 1, label: "scheduler-check" };
}

const result = await main();
// Exit codes: 0=PASS, 1=FAIL, 2=SKIP, 3=UNKNOWN
if (result.fail > 0) process.exit(1);
else if (result.pass > 0) process.exit(0);
else if (result.skip > 0) process.exit(3); // UNKNOWN — could not determine
else process.exit(3);
