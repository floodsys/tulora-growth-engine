#!/usr/bin/env node
/**
 * scripts/verify/retell-webhook-config.mjs
 *
 * Verifies that every Retell agent used by Tulora has the correct
 * production webhook_url configured and the expected webhook events.
 *
 * Env vars required:
 *   RETELL_API_KEY          – Retell platform API key (never printed)
 *   SUPABASE_URL            – e.g. https://nkjxbeypbiclvouqfjyc.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY – service-role key for DB queries (never printed)
 *
 * Exit codes:
 *   0 = PASS
 *   1 = FAIL
 *   2 = SKIP (credentials missing)
 */

const EXPECTED_WEBHOOK_PATH = "/functions/v1/retell-webhook";
const EXPECTED_EVENTS = ["call_started", "call_ended", "call_analyzed"];

// ─── helpers ────────────────────────────────────────────────────────────────
function redact(key) {
    if (!key) return "(unset)";
    return key.slice(0, 4) + "…" + key.slice(-4);
}

function table(rows) {
    if (!rows.length) {
        console.log("  (no rows)");
        return;
    }
    const cols = Object.keys(rows[0]);
    const widths = cols.map((c) =>
        Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length))
    );
    const sep = widths.map((w) => "─".repeat(w + 2)).join("┼");
    const hdr = cols.map((c, i) => ` ${c.padEnd(widths[i])} `).join("│");

    console.log(hdr);
    console.log(sep);
    for (const row of rows) {
        console.log(
            cols.map((c, i) => ` ${String(row[c] ?? "").padEnd(widths[i])} `).join("│")
        );
    }
}

// ─── main ───────────────────────────────────────────────────────────────────
async function main() {
    const RETELL_API_KEY = process.env.RETELL_API_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("\n🔍 Retell Webhook Config Verification");
    console.log("─".repeat(50));
    console.log(`  RETELL_API_KEY : ${redact(RETELL_API_KEY)}`);
    console.log(`  SUPABASE_URL   : ${SUPABASE_URL || "(unset)"}`);
    console.log(`  SERVICE_ROLE   : ${redact(SUPABASE_SERVICE_ROLE_KEY)}`);
    console.log();

    if (!RETELL_API_KEY) {
        console.error("✗ RETELL_API_KEY is not set. Skipping Retell check.");
        return { pass: 0, fail: 0, skip: 1, label: "retell-webhook-config" };
    }

    // ── Step 1: Get agent IDs from Supabase (preferred) or Retell list ──
    let agentIds = [];
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/retell_agents?select=agent_id,name,organization_id&is_active=eq.true`,
                {
                    headers: {
                        apikey: SUPABASE_SERVICE_ROLE_KEY,
                        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    },
                }
            );
            if (res.ok) {
                const data = await res.json();
                agentIds = data.map((r) => ({
                    agent_id: r.agent_id,
                    name: r.name,
                    org_id: r.organization_id,
                }));
                console.log(`  Found ${agentIds.length} active agent(s) in retell_agents table.`);
            } else {
                console.warn(`  ⚠ Could not query retell_agents (${res.status}). Falling back to Retell API list.`);
            }
        } catch (err) {
            console.warn(`  ⚠ DB query failed: ${err.message}. Falling back to Retell API list.`);
        }
    }

    // Fallback: list agents via Retell API
    if (!agentIds.length) {
        const listRes = await fetch("https://api.retellai.com/list-agents", {
            headers: { Authorization: `Bearer ${RETELL_API_KEY}` },
        });
        if (!listRes.ok) {
            console.error(`✗ Retell list-agents returned ${listRes.status}`);
            return { pass: 0, fail: 1, skip: 0, label: "retell-webhook-config" };
        }
        const agents = await listRes.json();
        agentIds = agents.map((a) => ({
            agent_id: a.agent_id,
            name: a.agent_name || a.agent_id,
            org_id: "—",
        }));
        console.log(`  Found ${agentIds.length} agent(s) via Retell API.`);
    }

    if (!agentIds.length) {
        console.log("  No agents found — nothing to verify.");
        return { pass: 0, fail: 0, skip: 1, label: "retell-webhook-config" };
    }

    // ── Step 2: Check each agent's webhook config ──
    const expectedUrlBase = SUPABASE_URL
        ? `${SUPABASE_URL}${EXPECTED_WEBHOOK_PATH}`
        : null;

    let pass = 0;
    let fail = 0;
    const rows = [];

    for (const { agent_id, name } of agentIds) {
        const res = await fetch(`https://api.retellai.com/get-agent/${agent_id}`, {
            headers: { Authorization: `Bearer ${RETELL_API_KEY}` },
        });

        if (!res.ok) {
            rows.push({
                agent_id: agent_id.slice(0, 12) + "…",
                name: name?.slice(0, 20) || "—",
                webhook_url: `(HTTP ${res.status})`,
                events: "—",
                result: "FAIL",
            });
            fail++;
            continue;
        }

        const agent = await res.json();
        const webhookUrl = agent.webhook_url || "(none)";
        const webhookEvents = agent.webhook_events || [];
        const eventStr = webhookEvents.length ? webhookEvents.join(",") : "(default/unset)";

        // Evaluate
        let urlOk = true;
        if (expectedUrlBase) {
            urlOk = webhookUrl === expectedUrlBase;
        } else {
            urlOk = webhookUrl.includes("/retell-webhook");
        }

        const eventsOk =
            webhookEvents.length === 0 || // unset = Retell defaults (OK)
            EXPECTED_EVENTS.every((e) => webhookEvents.includes(e));

        const result = urlOk && eventsOk ? "PASS" : "FAIL";
        if (result === "PASS") pass++;
        else fail++;

        rows.push({
            agent_id: agent_id.slice(0, 12) + "…",
            name: (name || "—").slice(0, 20),
            webhook_url: webhookUrl.length > 50 ? webhookUrl.slice(0, 47) + "…" : webhookUrl,
            events: eventStr.length > 30 ? eventStr.slice(0, 27) + "…" : eventStr,
            result,
        });
    }

    console.log();
    table(rows);
    console.log(`\n  ✓ ${pass} PASS  ✗ ${fail} FAIL\n`);

    return { pass, fail, skip: 0, label: "retell-webhook-config" };
}

// When run directly — exit codes: 0=PASS, 1=FAIL, 2=SKIP
const result = await main();
if (result.fail > 0) process.exit(1);
else if (result.skip > 0) process.exit(2);
