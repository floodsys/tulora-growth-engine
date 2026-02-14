/**
 * Tests for admin-observability-metrics edge function authz gate.
 * Verifies:
 *  - 401 when no Authorization header
 *  - 401 when invalid token
 *  - 405 when wrong HTTP method (POST)
 *  - GET with valid superadmin token returns 200 with expected schema
 *
 * Run: deno test -A supabase/functions/admin-observability-metrics/__tests__/authz.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_ANON_KEY") ?? "";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/admin-observability-metrics`;

// Skip all tests if no Supabase URL is configured
const skip = !SUPABASE_URL;

Deno.test({
    name: "admin-observability-metrics: returns 401 without Authorization header",
    ignore: skip,
    fn: async () => {
        const res = await fetch(FUNCTION_URL, {
            method: "GET",
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
            },
        });
        assertEquals(res.status, 401);
        const body = await res.json();
        assertExists(body.error);
    },
});

Deno.test({
    name: "admin-observability-metrics: returns 401 with invalid token",
    ignore: skip,
    fn: async () => {
        const res = await fetch(FUNCTION_URL, {
            method: "GET",
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": "Bearer invalid-token-12345",
                "Content-Type": "application/json",
            },
        });
        // Should be 401 (invalid token)
        assertEquals(res.status, 401);
        const body = await res.json();
        assertExists(body.error);
    },
});

Deno.test({
    name: "admin-observability-metrics: returns 405 for POST method",
    ignore: skip,
    fn: async () => {
        const res = await fetch(FUNCTION_URL, {
            method: "POST",
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        });
        assertEquals(res.status, 405);
        const body = await res.json();
        assertEquals(body.error, "Method not allowed");
    },
});

Deno.test({
    name: "admin-observability-metrics: response schema matches expected shape (requires superadmin token)",
    ignore: true, // Enable only when a superadmin service-role token is available in CI
    fn: async () => {
        const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const res = await fetch(FUNCTION_URL, {
            method: "GET",
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
            },
        });
        assertEquals(res.status, 200);
        const body = await res.json();

        // Verify top-level keys
        assertExists(body.generated_at);
        assertExists(body.retell_webhooks);
        assertExists(body.stripe_webhooks);
        assertExists(body.failures);
        assertExists(body.latency);
        assertExists(body.calls);

        // Verify nested shapes
        assertExists(body.retell_webhooks.last_1h);
        assertExists(body.retell_webhooks.last_24h);
        assertEquals(typeof body.retell_webhooks.last_1h.total, "number");
        assertEquals(typeof body.failures.last_1h, "number");
        assertEquals(typeof body.failures.last_24h, "number");
        assertEquals(Array.isArray(body.failures.recent_errors), true);
        assertEquals(typeof body.latency.sample_size, "number");
        assertEquals(typeof body.calls.active, "number");
        assertEquals(typeof body.calls.total_24h, "number");
        assertEquals(typeof body.calls.failed_24h, "number");
    },
});
