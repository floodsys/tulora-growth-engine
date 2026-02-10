/**
 * Unit Tests for contact-sales Turnstile server-side validation logic
 *
 * Validates that verifyTurnstileToken is FAIL-CLOSED:
 *  - Missing secret key → reject
 *  - Siteverify returns success:false → reject
 *  - Hostname mismatch → reject
 *  - Network/fetch error → reject
 *  - Valid token + matching hostname → accept
 *
 * Run with: deno test --allow-env --allow-net supabase/functions/_shared/__tests__/turnstileVerify.test.ts
 */

import {
    assertEquals,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";

// =============================================================================
// Re-implement the verifyTurnstileToken logic under test (extracted, no Deno.env)
// =============================================================================

interface TurnstileVerifyResult {
    valid: boolean;
    code?: 'missing_secret' | 'siteverify_rejected' | 'hostname_mismatch' | 'network_error';
}

/**
 * Pure-logic verifier that takes dependencies as arguments so we can test
 * without real env vars or real HTTP calls.
 */
async function verifyTurnstileToken(
    token: string,
    remoteIP: string | undefined,
    deps: {
        secretKey: string | undefined;
        allowedHostnames: string[];
        fetchFn: (url: string, init: RequestInit) => Promise<{ json: () => Promise<any> }>;
    }
): Promise<TurnstileVerifyResult> {
    const { secretKey, allowedHostnames, fetchFn } = deps;

    if (!secretKey) {
        return { valid: false, code: 'missing_secret' };
    }

    try {
        const response = await fetchFn(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    secret: secretKey,
                    response: token,
                    ...(remoteIP && { remoteip: remoteIP }),
                }),
            }
        );

        const result = await response.json();

        if (result.success !== true) {
            return { valid: false, code: 'siteverify_rejected' };
        }

        // Hostname check
        if (result.hostname && allowedHostnames.length > 0) {
            const returnedHost = result.hostname.toLowerCase();
            const hostAllowed = allowedHostnames.some(
                (allowed: string) =>
                    returnedHost === allowed || returnedHost.endsWith('.' + allowed)
            );
            if (!hostAllowed) {
                return { valid: false, code: 'hostname_mismatch' };
            }
        }

        return { valid: true };
    } catch {
        return { valid: false, code: 'network_error' };
    }
}

// =============================================================================
// Helper to build a mock fetch that returns a canned siteverify response
// =============================================================================

function mockFetch(response: Record<string, any>) {
    return async (_url: string, _init: RequestInit) => ({
        json: async () => response,
    });
}

function throwingFetch(_url: string, _init: RequestInit): Promise<never> {
    return Promise.reject(new Error('network down'));
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('verifyTurnstileToken (contact-sales)', () => {
    const ALLOWED = ['tulora-growth-engine.lovable.app', 'localhost'];

    describe('fail-closed: missing secret', () => {
        it('should reject when secret key is undefined', async () => {
            const result = await verifyTurnstileToken('tok_abc', undefined, {
                secretKey: undefined,
                allowedHostnames: ALLOWED,
                fetchFn: mockFetch({ success: true, hostname: 'localhost' }),
            });
            assertEquals(result.valid, false);
            assertEquals(result.code, 'missing_secret');
        });

        it('should reject when secret key is empty string', async () => {
            const result = await verifyTurnstileToken('tok_abc', undefined, {
                secretKey: '',
                allowedHostnames: ALLOWED,
                fetchFn: mockFetch({ success: true, hostname: 'localhost' }),
            });
            assertEquals(result.valid, false);
            assertEquals(result.code, 'missing_secret');
        });
    });

    describe('fail-closed: siteverify rejects', () => {
        it('should reject when siteverify returns success:false', async () => {
            const result = await verifyTurnstileToken('bad_token', '1.2.3.4', {
                secretKey: 'secret_xxx',
                allowedHostnames: ALLOWED,
                fetchFn: mockFetch({
                    success: false,
                    'error-codes': ['invalid-input-response'],
                }),
            });
            assertEquals(result.valid, false);
            assertEquals(result.code, 'siteverify_rejected');
        });

        it('should reject when success field is missing entirely', async () => {
            const result = await verifyTurnstileToken('tok', undefined, {
                secretKey: 'secret_xxx',
                allowedHostnames: ALLOWED,
                fetchFn: mockFetch({ hostname: 'localhost' }),
            });
            assertEquals(result.valid, false);
            assertEquals(result.code, 'siteverify_rejected');
        });
    });

    describe('fail-closed: hostname mismatch', () => {
        it('should reject when returned hostname is not in allowlist', async () => {
            const result = await verifyTurnstileToken('tok', undefined, {
                secretKey: 'secret_xxx',
                allowedHostnames: ALLOWED,
                fetchFn: mockFetch({
                    success: true,
                    hostname: 'evil-phishing.com',
                }),
            });
            assertEquals(result.valid, false);
            assertEquals(result.code, 'hostname_mismatch');
        });

        it('should reject partial substring that is not a subdomain', async () => {
            const result = await verifyTurnstileToken('tok', undefined, {
                secretKey: 'secret_xxx',
                allowedHostnames: ['example.com'],
                fetchFn: mockFetch({
                    success: true,
                    hostname: 'notexample.com',
                }),
            });
            assertEquals(result.valid, false);
            assertEquals(result.code, 'hostname_mismatch');
        });
    });

    describe('fail-closed: network error', () => {
        it('should reject when fetch throws', async () => {
            const result = await verifyTurnstileToken('tok', undefined, {
                secretKey: 'secret_xxx',
                allowedHostnames: ALLOWED,
                fetchFn: throwingFetch,
            });
            assertEquals(result.valid, false);
            assertEquals(result.code, 'network_error');
        });
    });

    describe('happy path', () => {
        it('should accept valid token with matching hostname', async () => {
            const result = await verifyTurnstileToken('tok_good', '1.2.3.4', {
                secretKey: 'secret_xxx',
                allowedHostnames: ALLOWED,
                fetchFn: mockFetch({
                    success: true,
                    hostname: 'tulora-growth-engine.lovable.app',
                    action: 'contact-sales',
                }),
            });
            assertEquals(result.valid, true);
            assertEquals(result.code, undefined);
        });

        it('should accept when hostname is a subdomain of an allowed host', async () => {
            const result = await verifyTurnstileToken('tok_good', undefined, {
                secretKey: 'secret_xxx',
                allowedHostnames: ['lovable.app'],
                fetchFn: mockFetch({
                    success: true,
                    hostname: 'preview.tulora.lovable.app',
                }),
            });
            assertEquals(result.valid, true);
        });

        it('should accept when siteverify returns no hostname (skip hostname check)', async () => {
            const result = await verifyTurnstileToken('tok_good', undefined, {
                secretKey: 'secret_xxx',
                allowedHostnames: ALLOWED,
                fetchFn: mockFetch({ success: true }),
            });
            assertEquals(result.valid, true);
        });

        it('should accept when allowedHostnames is empty (skip hostname check)', async () => {
            const result = await verifyTurnstileToken('tok_good', undefined, {
                secretKey: 'secret_xxx',
                allowedHostnames: [],
                fetchFn: mockFetch({
                    success: true,
                    hostname: 'any-domain.example',
                }),
            });
            assertEquals(result.valid, true);
        });
    });
});

console.log('🧪 Running turnstileVerify.test.ts...');
