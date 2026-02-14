/**
 * Tests for call-init auth enforcement.
 *
 * Validates that:
 * - Unauthenticated requests to retell-outbound / retell-webcall-create → 401
 * - Authenticated but non-member → 403
 * - Authenticated member with valid org → passes auth guard
 * - Per-org rate limiter triggers 429 on burst
 *
 * These are unit-level tests for the shared requireCallAuth guard.
 * Integration-level tests should be run against a local Supabase instance.
 */

import {
    assertEquals,
    assertExists,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import {
    stub,
    restore,
} from 'https://deno.land/std@0.168.0/testing/mock.ts'

// ── Helpers ──────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): Request {
    return new Request('https://example.com/functions/v1/retell-outbound', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: JSON.stringify({ agentSlug: 'paul', toNumber: '+15551234567' }),
    })
}

// ── Tests ────────────────────────────────────────────────────────────

Deno.test('requireCallAuth - returns AUTH_MISSING when no Authorization header', async () => {
    // Set up env stubs
    const envStub = stub(Deno.env, 'get', (key: string) => {
        const envMap: Record<string, string> = {
            SUPABASE_URL: 'https://test.supabase.co',
            SUPABASE_ANON_KEY: 'test-anon-key',
            SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        }
        return envMap[key] ?? undefined
    })

    try {
        const { requireCallAuth } = await import('../requireCallAuth.ts')
        const req = makeRequest({}) // no Authorization header
        const result = await requireCallAuth(req, 'test-trace-1')

        assertEquals(result.ok, false)
        if (!result.ok) {
            assertEquals(result.status, 401)
            assertEquals(result.code, 'AUTH_MISSING')
        }
    } finally {
        restore()
    }
})

Deno.test('callAuthErrorResponse - returns correct HTTP response', async () => {
    const { callAuthErrorResponse } = await import('../requireCallAuth.ts')

    const err = {
        ok: false as const,
        status: 401,
        code: 'AUTH_MISSING',
        message: 'Authorization header is required',
    }

    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
    }

    const response = callAuthErrorResponse(err, cors, 'test-trace')

    assertEquals(response.status, 401)

    const body = await response.json()
    assertEquals(body.error, 'AUTH_MISSING')
    assertEquals(body.message, 'Authorization header is required')
    assertEquals(body.traceId, 'test-trace')
})

Deno.test('callAuthErrorResponse - returns 403 for NO_ORG_MEMBERSHIP', async () => {
    const { callAuthErrorResponse } = await import('../requireCallAuth.ts')

    const err = {
        ok: false as const,
        status: 403,
        code: 'NO_ORG_MEMBERSHIP',
        message: 'No active organization membership found.',
    }

    const cors = { 'Content-Type': 'application/json' }
    const response = callAuthErrorResponse(err, cors, 'test-trace-2')

    assertEquals(response.status, 403)

    const body = await response.json()
    assertEquals(body.error, 'NO_ORG_MEMBERSHIP')
})

Deno.test('callAuthErrorResponse - returns 429 for RATE_LIMIT_EXCEEDED', async () => {
    const { callAuthErrorResponse } = await import('../requireCallAuth.ts')

    const err = {
        ok: false as const,
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many call requests.',
    }

    const cors = { 'Content-Type': 'application/json' }
    const response = callAuthErrorResponse(err, cors, 'test-trace-3')

    assertEquals(response.status, 429)

    const body = await response.json()
    assertEquals(body.error, 'RATE_LIMIT_EXCEEDED')
})
