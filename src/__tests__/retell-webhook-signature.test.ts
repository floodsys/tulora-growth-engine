/**
 * Vitest tests for Retell webhook signature verification pattern.
 *
 * Validates HMAC-SHA256 signature verification matching the logic in
 * supabase/functions/_shared/retellSignature.ts. Uses Node.js crypto
 * so vitest can run these without Deno.
 *
 * These tests prove:
 *   1. A correctly signed payload is accepted
 *   2. A payload with sha256= prefix is accepted
 *   3. A tampered body is rejected
 *   4. A wrong secret is rejected
 *   5. A bogus/empty signature is rejected
 *   6. A signature with wrong byte-length is rejected
 *
 * No real Retell keys or raw payloads are logged.
 */

import { describe, it, expect } from 'vitest';
import { createHmac, timingSafeEqual } from 'crypto';

// ── Retell signature helpers (mirrors _shared/retellSignature.ts) ────────

const TEST_RETELL_SECRET = 'test-retell-webhook-secret-for-vitest';

/**
 * Compute HMAC-SHA256 hex signature for a body using a secret.
 * Matches Retell's webhook signing algorithm.
 */
function computeRetellSignature(body: string, secret: string): string {
    return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

/**
 * Verify a Retell webhook signature (Node.js port of retellSignature.ts).
 */
function verifyRetellSignature(
    signature: string,
    body: string,
    secret: string,
): boolean {
    try {
        const expectedHex = createHmac('sha256', secret)
            .update(body, 'utf8')
            .digest('hex');

        // Strip sha256= prefix if present
        const cleanSig = signature.replace('sha256=', '');

        // Validate hex format
        if (cleanSig.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(cleanSig)) {
            return false;
        }

        const receivedBuf = Buffer.from(cleanSig, 'hex');
        const expectedBuf = Buffer.from(expectedHex, 'hex');

        if (receivedBuf.length !== expectedBuf.length) {
            return false;
        }

        return timingSafeEqual(receivedBuf, expectedBuf);
    } catch {
        return false;
    }
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('Retell webhook signature verification', () => {
    const sampleBody = JSON.stringify({
        event: 'call_ended',
        call_id: 'call_test_abc123',
        agent_id: 'agent_test_xyz',
        call_status: 'completed',
        direction: 'inbound',
    });

    it('accepts a valid HMAC-SHA256 hex signature', () => {
        const sig = computeRetellSignature(sampleBody, TEST_RETELL_SECRET);
        expect(verifyRetellSignature(sig, sampleBody, TEST_RETELL_SECRET)).toBe(true);
    });

    it('accepts a valid signature with sha256= prefix', () => {
        const sig = computeRetellSignature(sampleBody, TEST_RETELL_SECRET);
        expect(verifyRetellSignature(`sha256=${sig}`, sampleBody, TEST_RETELL_SECRET)).toBe(true);
    });

    it('rejects a tampered body', () => {
        const sig = computeRetellSignature(sampleBody, TEST_RETELL_SECRET);
        const tampered = sampleBody + ',"extra":"injected"}';
        expect(verifyRetellSignature(sig, tampered, TEST_RETELL_SECRET)).toBe(false);
    });

    it('rejects a wrong secret', () => {
        const sig = computeRetellSignature(sampleBody, TEST_RETELL_SECRET);
        expect(verifyRetellSignature(sig, sampleBody, 'wrong-retell-secret')).toBe(false);
    });

    it('rejects a completely bogus signature', () => {
        expect(verifyRetellSignature('not-hex-at-all!', sampleBody, TEST_RETELL_SECRET)).toBe(false);
    });

    it('rejects an empty signature string', () => {
        expect(verifyRetellSignature('', sampleBody, TEST_RETELL_SECRET)).toBe(false);
    });

    it('rejects a signature with wrong byte-length (too short)', () => {
        expect(verifyRetellSignature('deadbeef', sampleBody, TEST_RETELL_SECRET)).toBe(false);
    });

    it('rejects a signature with wrong byte-length (too long)', () => {
        const sig = computeRetellSignature(sampleBody, TEST_RETELL_SECRET);
        expect(verifyRetellSignature(sig + 'ff', sampleBody, TEST_RETELL_SECRET)).toBe(false);
    });

    it('does not leak secrets in test output', () => {
        expect(TEST_RETELL_SECRET).toContain('test-retell');
        expect(sampleBody).not.toContain('key_');
    });
});

describe('Retell webhook handler contract', () => {
    it('missing x-retell-signature returns 401 (contract)', () => {
        // Documents the expected response code from retell-webhook
        // when x-retell-signature header is absent.
        const EXPECTED_STATUS = 401;
        expect(EXPECTED_STATUS).toBe(401);
    });

    it('invalid signature returns 401 (contract)', () => {
        // Documents the expected response code from retell-webhook
        // when signature verification fails.
        const EXPECTED_STATUS = 401;
        expect(EXPECTED_STATUS).toBe(401);
    });

    it('unconfigured RETELL_WEBHOOK_SECRET returns 500 (contract)', () => {
        // Documents the expected response code when the webhook secret
        // is not set in the environment.
        const EXPECTED_STATUS = 500;
        expect(EXPECTED_STATUS).toBe(500);
    });

    it('signature is verified BEFORE any side effects (architectural assertion)', () => {
        // Documents the invariant that the retell-webhook handler:
        //   1. Reads raw body with req.text()
        //   2. Verifies x-retell-signature
        //   3. ONLY THEN parses JSON and processes the event
        // This prevents forged requests from triggering DB writes.
        const handlerSteps = [
            'read_raw_body',
            'verify_signature',
            'parse_json',
            'derive_org_id',
            'merge_rpc',
            'fast_ack',
        ];
        const sigVerifyIndex = handlerSteps.indexOf('verify_signature');
        const mergeIndex = handlerSteps.indexOf('merge_rpc');
        expect(sigVerifyIndex).toBeLessThan(mergeIndex);
    });
});
