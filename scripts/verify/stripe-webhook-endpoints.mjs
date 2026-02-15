#!/usr/bin/env node
/**
 * scripts/verify/stripe-webhook-endpoints.mjs
 *
 * Verifies Stripe webhook endpoints are configured correctly for production.
 * Checks that the org-billing-webhook endpoint exists and subscribes to
 * the required event types.
 *
 * Flags:
 *   --fix  If exactly one endpoint matches the expected URL and is missing
 *          required events, update it via Stripe API to include them.
 *          Existing enabled_events are preserved (union with required set).
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

const FIX_MODE = process.argv.includes("--fix");

// ─── helpers ────────────────────────────────────────────────────────────────
function authHeader(key) {
    return {
        Authorization: `Basic ${Buffer.from(key + ":").toString("base64")}`,
    };
}

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

// ─── Stripe API helpers ─────────────────────────────────────────────────────
async function listWebhookEndpoints(stripeKey) {
    const res = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=100", {
        headers: authHeader(stripeKey),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Stripe API returned ${res.status}: ${body.slice(0, 200)}`);
    }

    const { data: endpoints } = await res.json();
    return endpoints;
}

async function updateEndpointEvents(stripeKey, endpointId, enabledEvents) {
    const body = new URLSearchParams();
    enabledEvents.forEach((evt, i) => {
        body.append(`enabled_events[${i}]`, evt);
    });

    const res = await fetch(
        `https://api.stripe.com/v1/webhook_endpoints/${endpointId}`,
        {
            method: "POST",
            headers: {
                ...authHeader(stripeKey),
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
        }
    );

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Stripe API update returned ${res.status}: ${text.slice(0, 300)}`);
    }

    return res.json();
}

// ─── verification logic ─────────────────────────────────────────────────────
function evaluateEndpoints(endpoints, expectedUrl) {
    let pass = 0;
    let fail = 0;
    const rows = [];
    let billingEndpointFound = false;
    let billingEndpoint = null;
    let billingMissingEvents = [];

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
            billingEndpoint = ep;
        }

        // Check required events
        const missingEvents = isAllEvents
            ? []
            : REQUIRED_EVENTS.filter((e) => !enabledEvents.includes(e));

        if (isBillingEndpoint) {
            billingMissingEvents = missingEvents;
        }

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
    }

    return { pass, fail, rows, billingEndpointFound, billingEndpoint, billingMissingEvents };
}

// ─── main ───────────────────────────────────────────────────────────────────
async function main() {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

    console.log("\n🔍 Stripe Webhook Endpoints Verification");
    console.log("─".repeat(50));
    console.log(`  STRIPE_SECRET_KEY : ${redact(STRIPE_SECRET_KEY)}`);
    console.log(`  SUPABASE_URL      : ${SUPABASE_URL || "(unset)"}`);
    if (FIX_MODE) console.log("  Mode              : --fix (auto-fix enabled)");
    console.log();

    if (!STRIPE_SECRET_KEY) {
        console.error("✗ STRIPE_SECRET_KEY is not set. Skipping Stripe check.");
        return { pass: 0, fail: 0, skip: 1, label: "stripe-webhook-endpoints" };
    }

    // ── Step 1: List webhook endpoints via Stripe API ──
    let endpoints;
    try {
        endpoints = await listWebhookEndpoints(STRIPE_SECRET_KEY);
    } catch (err) {
        console.error(`✗ ${err.message}`);
        return { pass: 0, fail: 1, skip: 0, label: "stripe-webhook-endpoints" };
    }

    console.log(`  Found ${endpoints.length} webhook endpoint(s) in Stripe.\n`);

    if (!endpoints.length) {
        console.error("✗ No webhook endpoints configured in Stripe!");
        return { pass: 0, fail: 1, skip: 0, label: "stripe-webhook-endpoints" };
    }

    // ── Step 2: Evaluate each endpoint ──
    const expectedUrl = SUPABASE_URL
        ? `${SUPABASE_URL}${EXPECTED_WEBHOOK_PATH}`
        : null;

    let evaluation = evaluateEndpoints(endpoints, expectedUrl);

    console.log();
    table(evaluation.rows);
    console.log(`\n  ✓ ${evaluation.pass} PASS  ✗ ${evaluation.fail} FAIL\n`);

    // ── Step 3 (--fix): Auto-fix missing events if applicable ──
    if (FIX_MODE && evaluation.fail > 0 && evaluation.billingEndpoint) {
        const ep = evaluation.billingEndpoint;
        const missing = evaluation.billingMissingEvents;

        if (missing.length === 0) {
            console.log("  ℹ --fix: Billing endpoint found but failure is not due to missing events. Cannot auto-fix.\n");
        } else {
            // Count matching billing endpoints to ensure exactly 1
            const matchCount = endpoints.filter((e) => {
                const url = e.url || "";
                return expectedUrl ? url === expectedUrl : url.includes("/org-billing-webhook");
            }).length;

            if (matchCount !== 1) {
                console.error(`  ✗ --fix: Expected exactly 1 matching billing endpoint, found ${matchCount}. Aborting auto-fix.\n`);
            } else {
                console.log(`  🔧 --fix: Adding ${missing.length} missing event(s) to endpoint ${ep.id}:`);
                for (const evt of missing) {
                    console.log(`        + ${evt}`);
                }

                // Build union of existing events + required events
                const currentEvents = (ep.enabled_events || []).filter((e) => e !== "*");
                const mergedEvents = [...new Set([...currentEvents, ...REQUIRED_EVENTS])].sort();

                console.log(`  🔧 --fix: Updating endpoint with ${mergedEvents.length} total events…`);

                try {
                    await updateEndpointEvents(STRIPE_SECRET_KEY, ep.id, mergedEvents);
                    console.log("  ✓ --fix: Stripe endpoint updated successfully.\n");
                } catch (err) {
                    console.error(`  ✗ --fix: Failed to update endpoint: ${err.message}\n`);
                    return { pass: evaluation.pass, fail: evaluation.fail, skip: 0, label: "stripe-webhook-endpoints" };
                }

                // Re-fetch and re-verify
                console.log("  🔄 --fix: Re-fetching endpoints to verify…\n");
                try {
                    endpoints = await listWebhookEndpoints(STRIPE_SECRET_KEY);
                } catch (err) {
                    console.error(`  ✗ Re-fetch failed: ${err.message}`);
                    return { pass: 0, fail: 1, skip: 0, label: "stripe-webhook-endpoints" };
                }

                evaluation = evaluateEndpoints(endpoints, expectedUrl);
                console.log();
                table(evaluation.rows);
                console.log(`\n  ✓ ${evaluation.pass} PASS  ✗ ${evaluation.fail} FAIL\n`);
            }
        }
    }

    return { pass: evaluation.pass, fail: evaluation.fail, skip: 0, label: "stripe-webhook-endpoints" };
}

// When run directly — exit codes: 0=PASS, 1=FAIL, 2=SKIP
const result = await main();
if (result.fail > 0) process.exit(1);
else if (result.skip > 0) process.exit(2);
