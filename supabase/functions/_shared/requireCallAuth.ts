/**
 * Call-Init Authorization Guard
 *
 * Shared helper for retell-outbound and retell-webcall-create.
 * Requires authenticated user + active org membership to initiate paid calls.
 *
 * Includes a simple in-memory per-org rate limiter for closed-beta safety.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

// ── Types ────────────────────────────────────────────────────────────

export interface CallAuthResult {
    ok: true
    userId: string
    organizationId: string
    role: string
    supabaseUser: SupabaseClient   // request-scoped client (user context)
    supabaseAdmin: SupabaseClient  // service-role client
}

export interface CallAuthError {
    ok: false
    status: number
    code: string
    message: string
}

export type CallAuthOutcome = CallAuthResult | CallAuthError

// ── Rate Limiter (in-memory, per-org) ────────────────────────────────

const ORG_RATE_WINDOW_MS = 60_000   // 1 minute
const ORG_RATE_MAX_CALLS = 20      // max 20 call-init requests per org per minute

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function checkOrgRateLimit(orgId: string): boolean {
    const now = Date.now()

    // Garbage-collect expired buckets (at most once per call)
    for (const [key, bucket] of rateBuckets) {
        if (bucket.resetAt <= now) rateBuckets.delete(key)
    }

    const bucket = rateBuckets.get(orgId)
    if (!bucket || bucket.resetAt <= now) {
        rateBuckets.set(orgId, { count: 1, resetAt: now + ORG_RATE_WINDOW_MS })
        return true
    }
    if (bucket.count >= ORG_RATE_MAX_CALLS) return false
    bucket.count++
    return true
}

// ── Main Guard ──────────────────────────────────────────────────────

/**
 * Authenticate and authorize a call-init request.
 *
 * 1. Extract Authorization header → create request-scoped Supabase client
 * 2. supabase.auth.getUser() → 401 if missing/invalid
 * 3. Look up active org membership → 403 if none
 * 4. Per-org rate limit → 429 if exceeded
 *
 * Returns either a success result (with userId, orgId, role, clients)
 * or a structured error that the caller can turn into an HTTP Response.
 */
export async function requireCallAuth(
    req: Request,
    traceId: string,
): Promise<CallAuthOutcome> {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
        return {
            ok: false,
            status: 401,
            code: 'AUTH_MISSING',
            message: 'Authorization header is required',
        }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Request-scoped client uses the caller's JWT
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
    })

    // Service-role client for admin lookups
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // ── Step 1: Authenticate ──────────────────────────────────────────
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()

    if (authError || !user) {
        console.log(`[${traceId}] Auth failed: ${authError?.message ?? 'no user'}`)
        return {
            ok: false,
            status: 401,
            code: 'AUTH_INVALID',
            message: 'Invalid or expired authentication token',
        }
    }

    console.log(`[${traceId}] Authenticated user: ${user.id}`)

    // ── Step 2: Resolve org membership ────────────────────────────────
    const { data: membership, error: memberError } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .eq('seat_active', true)
        .limit(1)
        .single()

    if (memberError || !membership) {
        console.log(`[${traceId}] No active org membership for user ${user.id}`)
        return {
            ok: false,
            status: 403,
            code: 'NO_ORG_MEMBERSHIP',
            message: 'No active organization membership found. Join an organization to initiate calls.',
        }
    }

    console.log(`[${traceId}] Org membership: org=${membership.organization_id} role=${membership.role}`)

    // ── Step 3: Per-org rate limit ────────────────────────────────────
    if (!checkOrgRateLimit(membership.organization_id)) {
        console.log(`[${traceId}] Rate limit exceeded for org ${membership.organization_id}`)
        return {
            ok: false,
            status: 429,
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many call requests. Please wait a moment and try again.',
        }
    }

    return {
        ok: true,
        userId: user.id,
        organizationId: membership.organization_id,
        role: membership.role,
        supabaseUser,
        supabaseAdmin,
    }
}

/**
 * Turn a CallAuthError into an HTTP Response with CORS headers.
 */
export function callAuthErrorResponse(
    err: CallAuthError,
    cors: Record<string, string>,
    traceId: string,
): Response {
    return new Response(
        JSON.stringify({
            error: err.code,
            message: err.message,
            traceId,
        }),
        {
            status: err.status,
            headers: { ...cors, 'Content-Type': 'application/json' },
        },
    )
}
