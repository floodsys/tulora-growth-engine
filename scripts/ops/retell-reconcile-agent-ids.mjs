#!/usr/bin/env node
/**
 * scripts/ops/retell-reconcile-agent-ids.mjs
 *
 * CLI tool to reconcile retell_agents rows against the live Retell API.
 *
 * Default: DRY-RUN  — prints a plan table, no writes.
 * With --apply --yes: deactivates stale/placeholder rows (is_active=false).
 *
 * Flags:
 *   --apply   Enable write mode (still requires --yes)
 *   --yes     Confirm writes (required with --apply)
 *
 * Env vars (loaded from .env.local):
 *   RETELL_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Exit codes:
 *   0 = success (or dry-run complete)
 *   1 = error
 *   2 = missing env
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ─────────────────────────────────────────────────────────
function loadEnv() {
    try {
        const envPath = resolve(__dirname, "../../.env.local");
        const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
        for (const line of lines) {
            const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
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
    } catch {
        /* .env.local not found — rely on process env */
    }
}
loadEnv();

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const applyMode = process.argv.includes("--apply");
const yesFlag = process.argv.includes("--yes");

function redact(s) {
    return s ? s.slice(0, 4) + "…" + s.slice(-4) : "(unset)";
}

// ── Seed/placeholder ID patterns ────────────────────────────────────────────
const SEED_PATTERNS = [
    /^temp_/,
    /^agent_[0-9a-f]{5,}[a-z]{5,}$/i, // e.g. agent_12345abcde
    /^agent_[a-z]+[0-9]+$/i, // e.g. agent_klmno12345
    /^placeholder_/,
    /^test_/,
    /^demo_/,
    /^fake_/,
];

function looksLikeSeedId(agentId) {
    return SEED_PATTERNS.some((p) => p.test(agentId));
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
    console.log("\n🔧 Retell Agent ID Reconciler");
    console.log("─".repeat(50));
    console.log(`  Mode         : ${applyMode ? "APPLY" : "DRY-RUN"}`);
    console.log(`  RETELL_API_KEY : ${redact(RETELL_API_KEY)}`);
    console.log(`  SUPABASE_URL   : ${SUPABASE_URL || "(unset)"}`);
    console.log(`  SERVICE_ROLE   : ${redact(SERVICE_ROLE)}`);
    console.log();

    if (!RETELL_API_KEY || !SUPABASE_URL || !SERVICE_ROLE) {
        console.error("✗ Missing required env vars. Aborting.");
        process.exit(2);
    }

    if (applyMode && !yesFlag) {
        console.error(
            "✗ --apply requires --yes flag to confirm writes. Aborting."
        );
        process.exit(1);
    }

    // ── 1. Fetch DB agents ──────────────────────────────────────────────
    let dbAgents = [];
    for (const query of [
        "retell_agents?select=id,agent_id,name,organization_id,is_active,status,created_at,updated_at&is_active=eq.true",
        "retell_agents?select=id,agent_id,name,organization_id,is_active,status,created_at,updated_at",
    ]) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
            headers: {
                apikey: SERVICE_ROLE,
                Authorization: `Bearer ${SERVICE_ROLE}`,
            },
        });
        if (res.ok) {
            dbAgents = await res.json();
            if (dbAgents.length > 0) break;
        }
    }
    console.log(`  DB agents (is_active=true): ${dbAgents.length}`);

    if (!dbAgents.length) {
        console.log("  Nothing to reconcile.");
        return;
    }

    // ── 2. Fetch Retell agents (voice + chat) ───────────────────────────
    const retellAgentIds = new Set();
    const retellByName = {};

    // Voice agents
    try {
        const res = await fetch("https://api.retellai.com/list-agents", {
            headers: { Authorization: `Bearer ${RETELL_API_KEY}` },
        });
        if (res.ok) {
            const agents = await res.json();
            for (const a of agents) {
                retellAgentIds.add(a.agent_id);
                const name = (a.agent_name || "").toLowerCase().trim();
                if (name) {
                    if (!retellByName[name]) retellByName[name] = [];
                    retellByName[name].push({
                        agent_id: a.agent_id,
                        type: "voice",
                    });
                }
            }
            console.log(`  Retell voice agents: ${agents.length}`);
        }
    } catch {
        /* ignore */
    }

    // Chat agents
    try {
        const res = await fetch(
            "https://api.retellai.com/list-chat-agents",
            {
                headers: { Authorization: `Bearer ${RETELL_API_KEY}` },
            }
        );
        if (res.ok) {
            const agents = await res.json();
            for (const a of agents) {
                retellAgentIds.add(a.agent_id);
                const name = (a.agent_name || "").toLowerCase().trim();
                if (name) {
                    if (!retellByName[name]) retellByName[name] = [];
                    retellByName[name].push({
                        agent_id: a.agent_id,
                        type: "chat",
                    });
                }
            }
            console.log(`  Retell chat agents: ${agents.length}`);
        }
    } catch {
        /* ignore */
    }

    console.log(`  Total unique Retell IDs: ${retellAgentIds.size}`);
    console.log();

    // ── 3. Build plan ───────────────────────────────────────────────────
    const plan = [];

    for (const row of dbAgents) {
        const id = row.agent_id;
        const dbName = (row.name || "").toLowerCase().trim();
        const isSeed = looksLikeSeedId(id);
        const existsInRetell = retellAgentIds.has(id);

        // Name matching
        let nameMatches = retellByName[dbName] || [];
        let matchMethod = "none";
        let matchedRetellId = null;
        let confidence = "none";

        if (existsInRetell) {
            matchMethod = "id";
            matchedRetellId = id;
            confidence = "exact";
        } else if (nameMatches.length === 1) {
            matchMethod = "name";
            matchedRetellId = nameMatches[0].agent_id;
            confidence = "unique";
        } else if (nameMatches.length > 1) {
            matchMethod = "name";
            confidence = "ambiguous";
        }

        // Determine action
        let action = "skip";
        let reason = "";

        if (existsInRetell) {
            action = "ok";
            reason = "ID exists in Retell";
        } else if (isSeed) {
            action = "deactivate";
            reason = "seed/placeholder ID pattern";
        } else if (nameMatches.length === 1) {
            action = "update-id";
            reason = `unique name match → ${matchedRetellId}`;
        } else if (nameMatches.length > 1) {
            action = "skip";
            reason = `ambiguous name match (${nameMatches.length} candidates)`;
        } else {
            action = "deactivate";
            reason = "not found in Retell (no ID or name match)";
        }

        plan.push({
            db_id: row.id,
            agent_id: id,
            name: row.name || "—",
            org_id: (row.organization_id || "").slice(0, 8) + "…",
            match_method: matchMethod,
            confidence,
            matched_retell_id: matchedRetellId || "—",
            action,
            reason,
        });
    }

    // ── 4. Print plan table ─────────────────────────────────────────────
    console.log("  RECONCILIATION PLAN:");
    console.log("  " + "─".repeat(90));
    console.log(
        `  ${"agent_id".padEnd(26)} ${"name".padEnd(22)} ${"match".padEnd(8)} ${"confidence".padEnd(12)} ${"action".padEnd(14)} reason`
    );
    console.log("  " + "─".repeat(90));

    for (const p of plan) {
        console.log(
            `  ${p.agent_id.padEnd(26)} ${p.name.slice(0, 20).padEnd(22)} ${p.match_method.padEnd(8)} ${p.confidence.padEnd(12)} ${p.action.padEnd(14)} ${p.reason}`
        );
    }
    console.log("  " + "─".repeat(90));

    const toDeactivate = plan.filter((p) => p.action === "deactivate");
    const toUpdate = plan.filter((p) => p.action === "update-id");
    const ok = plan.filter((p) => p.action === "ok");
    const skipped = plan.filter((p) => p.action === "skip");

    console.log();
    console.log(`  Summary:`);
    console.log(`    OK (no change):    ${ok.length}`);
    console.log(`    Deactivate:        ${toDeactivate.length}`);
    console.log(`    Update ID (name):  ${toUpdate.length}`);
    console.log(`    Skip (ambiguous):  ${skipped.length}`);
    console.log();

    if (!applyMode) {
        console.log("  ℹ DRY-RUN mode — no changes made.");
        console.log(
            "  To apply: node scripts/ops/retell-reconcile-agent-ids.mjs --apply --yes"
        );
        console.log();
        return;
    }

    // ── 5. Apply changes ────────────────────────────────────────────────
    const writeCount = toDeactivate.length + toUpdate.length;
    if (writeCount === 0) {
        console.log("  ✓ Nothing to apply.");
        return;
    }

    console.log(`  ⚠ About to modify ${writeCount} row(s) in production DB.`);
    console.log();

    let applied = 0;
    let errors = 0;

    // Deactivate rows
    for (const p of toDeactivate) {
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/retell_agents?id=eq.${p.db_id}`,
                {
                    method: "PATCH",
                    headers: {
                        apikey: SERVICE_ROLE,
                        Authorization: `Bearer ${SERVICE_ROLE}`,
                        "Content-Type": "application/json",
                        Prefer: "return=minimal",
                    },
                    body: JSON.stringify({ is_active: false }),
                }
            );
            if (res.ok) {
                console.log(
                    `    ✓ Deactivated: ${p.agent_id} (${p.name})`
                );
                applied++;
            } else {
                console.log(
                    `    ✗ Failed to deactivate ${p.agent_id}: HTTP ${res.status}`
                );
                errors++;
            }
        } catch (err) {
            console.log(
                `    ✗ Error deactivating ${p.agent_id}: ${err.message}`
            );
            errors++;
        }
    }

    // Update IDs (unique name matches only)
    for (const p of toUpdate) {
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/retell_agents?id=eq.${p.db_id}`,
                {
                    method: "PATCH",
                    headers: {
                        apikey: SERVICE_ROLE,
                        Authorization: `Bearer ${SERVICE_ROLE}`,
                        "Content-Type": "application/json",
                        Prefer: "return=minimal",
                    },
                    body: JSON.stringify({
                        agent_id: p.matched_retell_id,
                    }),
                }
            );
            if (res.ok) {
                console.log(
                    `    ✓ Updated ID: ${p.agent_id} → ${p.matched_retell_id} (${p.name})`
                );
                applied++;
            } else {
                console.log(
                    `    ✗ Failed to update ${p.agent_id}: HTTP ${res.status}`
                );
                errors++;
            }
        } catch (err) {
            console.log(
                `    ✗ Error updating ${p.agent_id}: ${err.message}`
            );
            errors++;
        }
    }

    console.log();
    console.log(
        `  Done: ${applied} applied, ${errors} errors out of ${writeCount} planned.`
    );
    if (errors > 0) process.exit(1);
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
