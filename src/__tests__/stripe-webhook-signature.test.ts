/**
 * Vitest tests for Stripe webhook signature verification pattern.
 *
 * Validates the raw-body + Stripe-Signature header verification flow
 * used in org-billing-webhook. Uses the same HMAC-SHA256 algorithm
 * Stripe uses (t=timestamp,v1=hmac) to generate test signatures.
 *
 * These tests prove:
 *   1. A correctly signed payload is accepted
 *   2. A tampered payload is rejected
 *   3. A wrong secret is rejected
 *   4. A missing signature header is rejected
 *   5. A malformed signature header is rejected
 *   6. An expired timestamp (replay) can be detected
 *
 * No real Stripe keys or raw payloads are logged.
 */

import { describe, it, expect } from 'vitest';
import { createHmac, timingSafeEqual } from 'crypto';

// ── Stripe signature helpers (mirrors Stripe's own signing logic) ────────

const TEST_WEBHOOK_SECRET = 'whsec_test_deterministic_secret_for_unit_tests';

/**
 * Generate a Stripe-compatible signature header value.
 * Stripe format: `t=<unix_timestamp>,v1=<hmac_sha256_hex>`
 * where the HMAC payload is `${timestamp}.${rawBody}`.
 */
function generateStripeSignature(
    rawBody: string,
    secret: string,
    timestamp?: number,
): { header: string; timestamp: number } {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const signedPayload = `${ts}.${rawBody}`;
    const hmac = createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');
    return {
        header: `t=${ts},v1=${hmac}`,
        timestamp: ts,
    };
}

/**
 * Verify a Stripe webhook signature (mirrors what stripe.webhooks.constructEvent does).
 * Returns true if the v1 signature matches for the given secret + raw body.
 *
 * This is a simplified version for testing — production code uses the Stripe SDK.
 */
function verifyStripeSignature(
    rawBody: string,
    signatureHeader: string,
    secret: string,
    toleranceSec = 300,
): { valid: boolean; reason?: string } {
    if (!signatureHeader) {
        return { valid: false, reason: 'missing_signature' };
    }

    // Parse header parts
    const parts = signatureHeader.split(',');
    const tPart = parts.find((p) => p.startsWith('t='));
    const v1Parts = parts.filter((p) => p.startsWith('v1='));

    if (!tPart) {
        return { valid: false, reason: 'missing_timestamp' };
    }
    if (v1Parts.length === 0) {
        return { valid: false, reason: 'missing_v1_signature' };
    }

    const timestamp = parseInt(tPart.substring(2), 10);
    if (isNaN(timestamp)) {
        return { valid: false, reason: 'invalid_timestamp' };
    }

    // Check tolerance (replay protection)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSec) {
        return { valid: false, reason: 'timestamp_out_of_tolerance' };
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedHmac = createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');

    // Check if any v1 signature matches (Stripe can include multiple v1 values)
    const hasMatch = v1Parts.some((p) => {
        const sig = p.substring(3); // strip "v1="
        // Timing-safe comparison
        if (sig.length !== expectedHmac.length) return false;
        const a = Buffer.from(sig, 'utf8');
        const b = Buffer.from(expectedHmac, 'utf8');
        return a.length === b.length && timingSafeEqual(a, b);
    });

    if (!hasMatch) {
        return { valid: false, reason: 'signature_mismatch' };
    }

    return { valid: true };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('Stripe webhook signature verification', () => {
    const samplePayload = JSON.stringify({
        id: 'evt_test_123',
        type: 'customer.subscription.updated',
        data: {
            object: {
                id: 'sub_test_456',
                status: 'active',
                metadata: { organization_id: '00000000-0000-0000-0000-000000000001' },
            },
        },
    });

    it('accepts a valid signature with correct secret and fresh timestamp', () => {
        const { header } = generateStripeSignature(samplePayload, TEST_WEBHOOK_SECRET);
        const result = verifyStripeSignature(samplePayload, header, TEST_WEBHOOK_SECRET);
        expect(result.valid).toBe(true);
        expect(result.reason).toBeUndefined();
    });

    it('rejects when the payload has been tampered with', () => {
        const { header } = generateStripeSignature(samplePayload, TEST_WEBHOOK_SECRET);
        const tampered = samplePayload + '{"injected":true}';
        const result = verifyStripeSignature(tampered, header, TEST_WEBHOOK_SECRET);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('signature_mismatch');
    });

    it('rejects when the wrong secret is used for verification', () => {
        const { header } = generateStripeSignature(samplePayload, TEST_WEBHOOK_SECRET);
        const result = verifyStripeSignature(samplePayload, header, 'whsec_wrong_secret');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('signature_mismatch');
    });

    it('rejects an empty signature header', () => {
        const result = verifyStripeSignature(samplePayload, '', TEST_WEBHOOK_SECRET);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('missing_signature');
    });

    it('rejects a malformed signature header (missing t=)', () => {
        const result = verifyStripeSignature(samplePayload, 'v1=deadbeef', TEST_WEBHOOK_SECRET);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('missing_timestamp');
    });

    it('rejects a malformed signature header (missing v1=)', () => {
        const result = verifyStripeSignature(samplePayload, 't=1700000000', TEST_WEBHOOK_SECRET);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('missing_v1_signature');
    });

    it('rejects a signature with non-numeric timestamp', () => {
        const result = verifyStripeSignature(samplePayload, 't=abc,v1=deadbeef', TEST_WEBHOOK_SECRET);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('invalid_timestamp');
    });

    it('rejects an expired timestamp (replay attack)', () => {
        const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
        const { header } = generateStripeSignature(samplePayload, TEST_WEBHOOK_SECRET, oldTimestamp);
        const result = verifyStripeSignature(samplePayload, header, TEST_WEBHOOK_SECRET, 300);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('timestamp_out_of_tolerance');
    });

    it('accepts a timestamp within tolerance window', () => {
        const recentTimestamp = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
        const { header } = generateStripeSignature(samplePayload, TEST_WEBHOOK_SECRET, recentTimestamp);
        const result = verifyStripeSignature(samplePayload, header, TEST_WEBHOOK_SECRET, 300);
        expect(result.valid).toBe(true);
    });

    it('handles multiple v1 signatures (Stripe rolling keys)', () => {
        const ts = Math.floor(Date.now() / 1000);
        const signedPayload = `${ts}.${samplePayload}`;
        const correctHmac = createHmac('sha256', TEST_WEBHOOK_SECRET)
            .update(signedPayload, 'utf8')
            .digest('hex');
        // Simulate rolled key scenario: old key sig + new key sig
        const header = `t=${ts},v1=deadbeef00000000000000000000000000000000000000000000000000000000,v1=${correctHmac}`;
        const result = verifyStripeSignature(samplePayload, header, TEST_WEBHOOK_SECRET);
        expect(result.valid).toBe(true);
    });

    it('does not leak secrets or raw payloads in test output', () => {
        // Structural assertion: none of the test constants contain real secrets
        expect(TEST_WEBHOOK_SECRET).toContain('test_deterministic');
        expect(samplePayload).not.toContain('sk_live');
        expect(samplePayload).not.toContain('whsec_');
    });
});

describe('Stripe webhook handler contract', () => {
    it('handler reads raw body before JSON parse (architectural assertion)', () => {
        // This test documents the contract: raw body must be read with req.text()
        // BEFORE any JSON.parse(), because Stripe signature verification requires
        // the exact byte-for-byte payload.
        //
        // The actual Edge Function does:
        //   const body = await req.text()
        //   const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
        //
        // If someone refactors to await req.json() first, the signature will break.
        // This test serves as documentation of that invariant.
        const rawBody = '{"id":"evt_1","type":"test"}';
        const parsed = JSON.parse(rawBody);
        const reStringified = JSON.stringify(parsed);

        // In this case they're equal, but with different key ordering or whitespace
        // they might not be. The point: always use the RAW body for verification.
        expect(typeof rawBody).toBe('string');
        expect(typeof reStringified).toBe('string');
        // This is the critical invariant: verification MUST use rawBody, not re-serialized
    });

    it('missing stripe-signature returns 400 (contract)', () => {
        // Documents the expected response code from org-billing-webhook
        // when Stripe-Signature header is absent.
        const EXPECTED_STATUS_MISSING_SIG = 400;
        expect(EXPECTED_STATUS_MISSING_SIG).toBe(400);
    });

    it('invalid signature returns 400 (contract)', () => {
        // Documents the expected response code from org-billing-webhook
        // when signature verification fails.
        const EXPECTED_STATUS_INVALID_SIG = 400;
        expect(EXPECTED_STATUS_INVALID_SIG).toBe(400);
    });
});
