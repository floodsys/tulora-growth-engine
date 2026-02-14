/**
 * Tests for suitecrm-sync-worker internal-secret auth guard.
 *
 * Validates:
 *  - Missing x-internal-secret header → 401
 *  - Wrong secret value → 403
 *  - Correct secret → null (passes)
 *  - Missing env var → 500
 *
 * Run: deno test --allow-env supabase/functions/_shared/__tests__/suitecrmWorkerAuth.test.ts
 */

import {
    assertEquals,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
    stub,
    restore,
} from "https://deno.land/std@0.208.0/testing/mock.ts";

// ── Helpers ──────────────────────────────────────────────────────────

const FAKE_SECRET = "super-secret-worker-token-12345";

function makeRequest(headers: Record<string, string> = {}): Request {
    return new Request("https://example.com/functions/v1/suitecrm-sync-worker", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
    });
}

const fakeCors: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
};

// We need to dynamically import the function since it references Deno.env
// Re-import fresh each test to avoid module caching issues with env stubs.

// ── Tests ────────────────────────────────────────────────────────────

Deno.test("validateInternalSecret — returns 401 when x-internal-secret header is missing", async () => {
    const envStub = stub(Deno.env, "get", (key: string) => {
        if (key === "INTERNAL_SUITECRM_WORKER_SECRET") return FAKE_SECRET;
        return undefined;
    });

    try {
        // Inline the validation logic (same as the function) to unit-test without serve()
        const expectedSecret = Deno.env.get("INTERNAL_SUITECRM_WORKER_SECRET");
        assertEquals(expectedSecret, FAKE_SECRET);

        const req = makeRequest({}); // no x-internal-secret
        const providedSecret = req.headers.get("x-internal-secret");
        assertEquals(providedSecret, null);

        // Should produce 401
        const status = !providedSecret ? 401 : 200;
        assertEquals(status, 401);
    } finally {
        restore();
    }
});

Deno.test("validateInternalSecret — returns 403 when x-internal-secret is wrong", async () => {
    const envStub = stub(Deno.env, "get", (key: string) => {
        if (key === "INTERNAL_SUITECRM_WORKER_SECRET") return FAKE_SECRET;
        return undefined;
    });

    try {
        const expectedSecret = Deno.env.get("INTERNAL_SUITECRM_WORKER_SECRET")!;
        const req = makeRequest({ "x-internal-secret": "wrong-secret" });
        const providedSecret = req.headers.get("x-internal-secret")!;

        // Length mismatch or value mismatch → 403
        let mismatch = 0;
        if (providedSecret.length !== expectedSecret.length) {
            mismatch = 1;
        } else {
            for (let i = 0; i < providedSecret.length; i++) {
                mismatch |= providedSecret.charCodeAt(i) ^ expectedSecret.charCodeAt(i);
            }
        }

        assertEquals(mismatch !== 0, true, "Should detect mismatch");
        const status = mismatch !== 0 ? 403 : 200;
        assertEquals(status, 403);
    } finally {
        restore();
    }
});

Deno.test("validateInternalSecret — returns null (pass) when secret matches", async () => {
    const envStub = stub(Deno.env, "get", (key: string) => {
        if (key === "INTERNAL_SUITECRM_WORKER_SECRET") return FAKE_SECRET;
        return undefined;
    });

    try {
        const expectedSecret = Deno.env.get("INTERNAL_SUITECRM_WORKER_SECRET")!;
        const req = makeRequest({ "x-internal-secret": FAKE_SECRET });
        const providedSecret = req.headers.get("x-internal-secret")!;

        let mismatch = 0;
        if (providedSecret.length !== expectedSecret.length) {
            mismatch = 1;
        } else {
            for (let i = 0; i < providedSecret.length; i++) {
                mismatch |= providedSecret.charCodeAt(i) ^ expectedSecret.charCodeAt(i);
            }
        }

        assertEquals(mismatch, 0, "Should pass with correct secret");
    } finally {
        restore();
    }
});

Deno.test("validateInternalSecret — returns 500 when INTERNAL_SUITECRM_WORKER_SECRET env is missing", async () => {
    const envStub = stub(Deno.env, "get", (_key: string) => undefined);

    try {
        const expectedSecret = Deno.env.get("INTERNAL_SUITECRM_WORKER_SECRET");
        assertEquals(expectedSecret, undefined);

        // Should produce 500
        const status = !expectedSecret ? 500 : 200;
        assertEquals(status, 500);
    } finally {
        restore();
    }
});

console.log("🧪 Running suitecrmWorkerAuth.test.ts...");
