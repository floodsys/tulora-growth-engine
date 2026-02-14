#!/usr/bin/env node
/**
 * scripts/verify/stripe-webhook-endpoints.mjs
 *
 * Verifies Stripe webhook endpoints are configured correctly for production.
 * Checks that the org-billing-webhook endpoint exists and subscribes to
 * the required event types.
 *
 * Env vars required:
 *   STRIPE_SECRET_KEY  – Stripe secret key (never printed)
 *   SUPABASE_URL       – used to derive expected endpoint URL
 *
 * Exit codes:
 *   0 = PASS
 *   1 = FAIL
 *   2 = SKIP (credentials missing)
 */

const REQUIRED_EVENTS = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed",
];

const EXPECTED_WEBHOOK_PATH = "/functions/v1/org-billing-webhook";

// ─── helpers ────────────────────────────────────────────────────────────────
function redact(key) {
    if (!key) return "(unset)";
    return key.slice(0, 7) + "…" + key.slice(-4);
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
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

    console.log("\n🔍 Stripe Webhook Endpoints Verification");
    console.log("─".repeat(50));
    console.log(`  STRIPE_SECRET_KEY : ${redact(STRIPE_SECRET_KEY)}`);
    console.log(`  SUPABASE_URL      : ${SUPABASE_URL || "(unset)"}`);
    console.log();

    if (!STRIPE_SECRET_KEY) {
        console.error("✗ STRIPE_SECRET_KEY is not set. Skipping Stripe check.");
        return { pass: 0, fail: 0, skip: 1, label: "stripe-webhook-endpoints" };
    }

    // ── Step 1: List webhook endpoints via Stripe API ──
    const res = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=100", {
        headers: {
            Authorization: `Basic ${Buffer.from(STRIPE_SECRET_KEY + ":").toString("base64")}`,
        },
    });

    if (!res.ok) {
        const body = await res.text();
        console.error(`✗ Stripe API returned ${res.status}: ${body.slice(0, 200)}`);
        return { pass: 0, fail: 1, skip: 0, label: "stripe-webhook-endpoints" };
    }

    const { data: endpoints } = await res.json();
    console.log(`  Found ${endpoints.length} webhook endpoint(s) in Stripe.\n`);

    if (!endpoints.length) {
        console.error("✗ No webhook endpoints configured in Stripe!");
        return { pass: 0, fail: 1, skip: 0, label: "stripe-webhook-endpoints" };
    }

    // ── Step 2: Evaluate each endpoint ──
    const expectedUrl = SUPABASE_URL
        ? `${SUPABASE_URL}${EXPECTED_WEBHOOK_PATH}`
        : null;

    let pass = 0;
    let fail = 0;
    const rows = [];
    let billingEndpointFound = false;

    for (const ep of endpoints) {
        const url = ep.url || "(none)";
        const status = ep.status || "unknown";
        const enabledEvents = ep.enabled_events || [];
        const isAllEvents = enabledEvents.includes("*");

        // Check if this is our billing webhook
        const isBillingEndpoint = expectedUrl
            ? url === expectedUrl
            : url.includes("/org-billing-webhook");

        if (isBillingEndpoint) {
            billingEndpointFound = true;
        }

        // Check required events
        const missingEvents = isAllEvents
            ? []
            : REQUIRED_EVENTS.filter((e) => !enabledEvents.includes(e));

        const eventsOk = isAllEvents || missingEvents.length === 0;
        const statusOk = status === "enabled";

        let result;
        if (!isBillingEndpoint) {
            result = "INFO"; // Not our endpoint, just informational
        } else if (statusOk && eventsOk) {
            result = "PASS";
            pass++;
        } else {
            result = "FAIL";
            fail++;
        }

        const eventSummary = isAllEvents
            ? "*  (all)"
            : `${enabledEvents.length} events` +
            (missingEvents.length ? ` (missing: ${missingEvents.join(", ")})` : "");

        rows.push({
            id: ep.id?.slice(0, 16) + "…",
            url: url.length > 45 ? url.slice(0, 42) + "…" : url,
            status,
            events: eventSummary.length > 40 ? eventSummary.slice(0, 37) + "…" : eventSummary,
            result,
        });
    }

    if (!billingEndpointFound) {
        rows.push({
            id: "(missing)",
            url: expectedUrl || EXPECTED_WEBHOOK_PATH,
            status: "—",
            events: "—",
            result: "FAIL",
        });
        fail++;
        console.error(`  ⚠ No billing webhook endpoint found matching ${expectedUrl || EXPECTED_WEBHOOK_PATH}`);
    }

    console.log();
    table(rows);
    console.log(`\n  ✓ ${pass} PASS  ✗ ${fail} FAIL\n`);

    return { pass, fail, skip: 0, label: "stripe-webhook-endpoints" };
}

// When run directly — exit codes: 0=PASS, 1=FAIL, 2=SKIP
const result = await main();
if (result.fail > 0) process.exit(1);
else if (result.skip > 0) process.exit(2);
