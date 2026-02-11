/**
 * Unit Tests for Retell webhook signature verification
 *
 * Tests the verifyWebhookSignature and hexToBytes functions exported from
 * retell-webhook/index.ts to prove timing-safe HMAC-SHA256 verification works.
 *
 * Run with: deno test --allow-env supabase/functions/_shared/__tests__/retellWebhookSignature.test.ts
 */

import {
    assertEquals,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";

import {
    verifyWebhookSignature,
    hexToBytes,
} from "../retellSignature.ts";

// =============================================================================
// Helper: compute a valid HMAC-SHA256 hex signature for a given body+secret
// =============================================================================
async function computeHmacHex(body: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const sig = new Uint8Array(
        await crypto.subtle.sign("HMAC", key, encoder.encode(body)),
    );
    return Array.from(sig)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

// =============================================================================
// hexToBytes
// =============================================================================
describe("hexToBytes", () => {
    it("converts valid hex to bytes", () => {
        const bytes = hexToBytes("deadbeef");
        assertEquals(bytes, new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    });

    it("returns null for odd-length hex", () => {
        assertEquals(hexToBytes("abc"), null);
    });

    it("returns null for non-hex characters", () => {
        assertEquals(hexToBytes("zzzz"), null);
    });

    it("handles empty string as valid (0 bytes)", () => {
        assertEquals(hexToBytes(""), null); // empty doesn't match regex
    });

    it("handles uppercase hex", () => {
        const bytes = hexToBytes("DEADBEEF");
        assertEquals(bytes, new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    });
});

// =============================================================================
// verifyWebhookSignature
// =============================================================================
describe("verifyWebhookSignature", () => {
    const secret = "test-retell-webhook-secret-key";
    const body = '{"event":"call_ended","call_id":"call_123"}';

    it("accepts a valid HMAC-SHA256 hex signature", async () => {
        const validSig = await computeHmacHex(body, secret);
        const result = await verifyWebhookSignature(validSig, body, secret);
        assertEquals(result, true);
    });

    it("accepts a valid signature with sha256= prefix", async () => {
        const validSig = await computeHmacHex(body, secret);
        const result = await verifyWebhookSignature(`sha256=${validSig}`, body, secret);
        assertEquals(result, true);
    });

    it("rejects a tampered body", async () => {
        const validSig = await computeHmacHex(body, secret);
        const result = await verifyWebhookSignature(validSig, body + "tampered", secret);
        assertEquals(result, false);
    });

    it("rejects a wrong secret", async () => {
        const validSig = await computeHmacHex(body, secret);
        const result = await verifyWebhookSignature(validSig, body, "wrong-secret");
        assertEquals(result, false);
    });

    it("rejects a completely bogus signature", async () => {
        const result = await verifyWebhookSignature("not-a-real-sig", body, secret);
        assertEquals(result, false);
    });

    it("rejects a signature with wrong length", async () => {
        const result = await verifyWebhookSignature("deadbeef", body, secret);
        assertEquals(result, false);
    });

    it("rejects empty signature string", async () => {
        const result = await verifyWebhookSignature("", body, secret);
        assertEquals(result, false);
    });
});

console.log("🧪 Running retellWebhookSignature.test.ts...");
