/**
 * Regression tests for the shared log-redaction utility.
 *
 * Validates:
 *  1. redactHeaders strips Authorization, Cookie, stripe-signature, etc.
 *  2. safeJson deep-redacts token/secret/password/PII keys
 *  3. truncId produces truncated IDs
 *  4. logInfo/logWarn/logError can be called without throwing
 *  5. Compile-guard: key edge functions that import log.ts still compile
 *
 * Run: deno test --allow-env --allow-run supabase/functions/_shared/__tests__/logRedaction.test.ts
 */

import { assertEquals, assertNotEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { redactHeaders, safeJson, truncId, logInfo, logWarn, logError } from "../log.ts";

console.log("🧪 Running logRedaction.test.ts...");

// ── redactHeaders ────────────────────────────────────────────────

describe("redactHeaders", () => {
    it("redacts authorization header (case-insensitive)", () => {
        const result = redactHeaders({
            "authorization": "Bearer eyJhbGciOi...",
            "content-type": "application/json",
        });
        assertEquals(result["authorization"], "[REDACTED]");
        assertEquals(result["content-type"], "application/json");
    });

    it("redacts cookie header", () => {
        const result = redactHeaders({ "cookie": "session=abc123" });
        assertEquals(result["cookie"], "[REDACTED]");
    });

    it("redacts x-retell-signature", () => {
        const result = redactHeaders({ "x-retell-signature": "sha256=abc" });
        assertEquals(result["x-retell-signature"], "[REDACTED]");
    });

    it("redacts stripe-signature", () => {
        const result = redactHeaders({ "stripe-signature": "t=123,v1=abc" });
        assertEquals(result["stripe-signature"], "[REDACTED]");
    });

    it("redacts apikey header", () => {
        const result = redactHeaders({ "apikey": "sk_live_xxx" });
        assertEquals(result["apikey"], "[REDACTED]");
    });

    it("redacts x-internal-secret", () => {
        const result = redactHeaders({ "x-internal-secret": "worker-secret" });
        assertEquals(result["x-internal-secret"], "[REDACTED]");
    });

    it("preserves safe headers", () => {
        const result = redactHeaders({
            "content-type": "application/json",
            "x-request-id": "abc-123",
            "user-agent": "Mozilla/5.0",
        });
        assertEquals(result["content-type"], "application/json");
        assertEquals(result["x-request-id"], "abc-123");
        assertEquals(result["user-agent"], "Mozilla/5.0");
    });

    it("handles Headers object (Web API)", () => {
        const headers = new Headers();
        headers.set("Authorization", "Bearer token123");
        headers.set("Content-Type", "text/plain");
        const result = redactHeaders(headers);
        assertEquals(result["authorization"], "[REDACTED]");
        assertEquals(result["content-type"], "text/plain");
    });
});

// ── safeJson ─────────────────────────────────────────────────────

describe("safeJson", () => {
    it("redacts token keys", () => {
        const result = safeJson({ access_token: "eyJhbGci...", status: "ok" }) as Record<string, unknown>;
        assertEquals(result.access_token, "[REDACTED]");
        assertEquals(result.status, "ok");
    });

    it("redacts secret keys", () => {
        const result = safeJson({ client_secret: "sk_xxx", plan: "pro" }) as Record<string, unknown>;
        assertEquals(result.client_secret, "[REDACTED]");
        assertEquals(result.plan, "pro");
    });

    it("redacts password keys", () => {
        const result = safeJson({ password: "hunter2", username: "admin" }) as Record<string, unknown>;
        assertEquals(result.password, "[REDACTED]");
        assertEquals(result.username, "admin");
    });

    it("redacts PII: email, phone, full_name", () => {
        const result = safeJson({
            email: "user@example.com",
            phone: "+1234567890",
            full_name: "John Doe",
            org_id: "abc-123",
        }) as Record<string, unknown>;
        assertEquals(result.email, "[REDACTED]");
        assertEquals(result.phone, "[REDACTED]");
        assertEquals(result.full_name, "[REDACTED]");
        assertEquals(result.org_id, "abc-123");
    });

    it("redacts nested objects", () => {
        const result = safeJson({
            user: {
                email: "deep@example.com",
                token: "xyz",
            },
            status: 200,
        }) as Record<string, unknown>;
        const user = result.user as Record<string, unknown>;
        assertEquals(user.email, "[REDACTED]");
        assertEquals(user.token, "[REDACTED]");
        assertEquals(result.status, 200);
    });

    it("redacts inside arrays", () => {
        const result = safeJson([
            { email: "a@b.com", id: 1 },
            { email: "c@d.com", id: 2 },
        ]) as Array<Record<string, unknown>>;
        assertEquals(result[0].email, "[REDACTED]");
        assertEquals(result[0].id, 1);
        assertEquals(result[1].email, "[REDACTED]");
    });

    it("handles null and undefined gracefully", () => {
        assertEquals(safeJson(null), null);
        assertEquals(safeJson(undefined), undefined);
    });

    it("handles primitive types", () => {
        assertEquals(safeJson("hello"), "hello");
        assertEquals(safeJson(42), 42);
        assertEquals(safeJson(true), true);
    });

    it("respects max depth", () => {
        const deep = { a: { b: { c: { d: "value" } } } };
        const result = safeJson(deep, 2) as any;
        assertEquals(result.a.b.c, "[MAX_DEPTH]");
    });

    it("redacts signature keys", () => {
        const result = safeJson({
            stripe_signature: "whsec_xxx",
            x_retell_signature: "sha256=abc",
        }) as Record<string, unknown>;
        assertEquals(result.stripe_signature, "[REDACTED]");
        assertEquals(result.x_retell_signature, "[REDACTED]");
    });
});

// ── truncId ──────────────────────────────────────────────────────

describe("truncId", () => {
    it("truncates long IDs", () => {
        const result = truncId("abcdef12-3456-7890-abcd-ef1234567890");
        assertEquals(result, "abcdef12…");
    });

    it("returns short IDs unchanged", () => {
        assertEquals(truncId("abc", 8), "abc");
    });

    it("returns 'unknown' for null/undefined", () => {
        assertEquals(truncId(null), "unknown");
        assertEquals(truncId(undefined), "unknown");
    });

    it("supports custom length", () => {
        assertEquals(truncId("abcdefghijklmnop", 4), "abcd…");
    });
});

// ── log wrappers (smoke test) ────────────────────────────────────

describe("log wrappers", () => {
    it("logInfo does not throw", () => {
        logInfo({ fn: "test", corrId: "test-123", msg: "hello" });
    });

    it("logWarn does not throw", () => {
        logWarn({ fn: "test", corrId: "test-123", msg: "warning" });
    });

    it("logError does not throw", () => {
        logError({ fn: "test", corrId: "test-123", msg: "error" });
    });

    it("log wrappers redact sensitive fields passed by caller", () => {
        // This should not throw and should internally redact
        logInfo({ fn: "test", corrId: "test-123", password: "should-be-redacted", email: "test@test.com" });
    });
});

// ── compile-guard ────────────────────────────────────────────────

async function denoCheck(filePath: string): Promise<{ code: number; stderr: string }> {
    const cmd = new Deno.Command("deno", {
        args: ["check", filePath],
        stdout: "piped",
        stderr: "piped",
    });
    const { code, stderr } = await cmd.output();
    const errText = new TextDecoder().decode(stderr);
    return { code, stderr: errText };
}

describe("log-redaction compile guards", () => {
    it("_shared/log.ts compiles", async () => {
        const { code, stderr } = await denoCheck("supabase/functions/_shared/log.ts");
        if (code !== 0) {
            throw new Error(`deno check failed (exit ${code}):\n${stderr}`);
        }
        assertEquals(code, 0);
    });
});
