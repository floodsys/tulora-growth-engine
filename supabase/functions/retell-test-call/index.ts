/**
 * Retell Test Call - Internal Testing Endpoint
 * 
 * This endpoint allows test calls for TESTING and ACTIVE agents.
 * It's designed for internal developer/demo testing, NOT for production widgets.
 * 
 * Key differences from production endpoints:
 * - Allows TESTING status agents (via checkAgentForTestCalls)
 * - Requires authenticated user with org membership
 * - Intended for internal testing UI (TestCallsTab, AgentSettings, etc.)
 * 
 * Production endpoints (retell-webcall-create, retell-dial, retell-dial-outbound)
 * still enforce ACTIVE-only via checkAgentForCalls.
 */

import { getCorsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkUsageQuota } from '../_shared/billingUsage.ts'
import { checkAgentForTestCalls, createAgentStatusErrorResponse } from '../_shared/agentStatus.ts'

interface TestCallRequest {
    agentId: string
    callType: 'web' | 'phone'
    phoneNumber?: string // Required for phone call type
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
    // Trace ID for logging
    const traceId = `trace_${Date.now()}_${crypto.randomUUID().slice(0, 10)}`
    const log = (msg: string) => console.log(`[${traceId}] ${msg}`)

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'METHOD_NOT_ALLOWED', traceId }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        )

        // Get the authenticated user - REQUIRED for test calls
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            log('Unauthorized: no authenticated user')
            return new Response(
                JSON.stringify({ error: 'Unauthorized', message: 'Authentication required for test calls', traceId }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get user's organization
        const { data: membership } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .eq('seat_active', true)
            .single()

        if (!membership) {
            log('No active organization membership')
            return new Response(
                JSON.stringify({ error: 'No active organization membership', traceId }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const body: TestCallRequest = await req.json()
        const { agentId, callType, phoneNumber } = body

        if (!agentId || !callType) {
            log('Missing required fields: agentId or callType')
            return new Response(
                JSON.stringify({ error: 'Agent ID and call type are required', traceId }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (callType === 'phone' && !phoneNumber) {
            log('Phone number required for phone call type')
            return new Response(
                JSON.stringify({ error: 'Phone number is required for phone calls', traceId }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        log(`Test call request: agentId=${agentId}, callType=${callType}`)

        // Create admin client for privileged operations
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // AGENT STATUS CHECK: TESTING or ACTIVE agents can receive test calls
        const agentStatusCheck = await checkAgentForTestCalls(supabaseAdmin, agentId, traceId)

        if (!agentStatusCheck.allowed) {
            log(`Agent status check failed for ${agentId}: ${agentStatusCheck.error?.message}`)
            return createAgentStatusErrorResponse(agentStatusCheck, corsHeaders, traceId)
        }

        // Verify agent belongs to the user's organization
        if (agentStatusCheck.agent?.organization_id !== membership.organization_id) {
            log(`Agent ${agentId} does not belong to org ${membership.organization_id}`)
            return new Response(
                JSON.stringify({
                    error: 'AGENT_NOT_FOUND',
                    message: 'Agent not found or not accessible',
                    traceId
                }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Check usage quota before initiating call
        const quotaResult = await checkUsageQuota(
            supabaseAdmin,
            membership.organization_id,
            'calls',
            traceId
        )

        if (!quotaResult.allowed && quotaResult.reason === 'over_limit') {
            log(`Blocked test call for org ${membership.organization_id}: quota exceeded (${quotaResult.current}/${quotaResult.limit})`)
            return new Response(
                JSON.stringify({
                    status: 402,
                    code: 'BILLING_OVER_LIMIT',
                    metric: 'calls',
                    remaining: 0,
                    limit: quotaResult.limit,
                    current: quotaResult.current,
                    message: 'Monthly call limit exceeded. Please upgrade your plan.',
                    traceId
                }),
                { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { RETELL_API_KEY } = await import('../_shared/env.ts')
        const retellApiKey = RETELL_API_KEY()

        if (callType === 'web') {
            // Create web call session
            const webUrl = Deno.env.get("RETELL_WEB_CREATE_URL") ?? "https://api.retellai.com/v2/create-web-call"

            const retellResponse = await fetch(webUrl, {
                method: "POST",
                headers: {
                    'Authorization': `Bearer ${retellApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    metadata: {
                        organization_id: membership.organization_id,
                        initiated_by: user.id,
                        test_call: true,
                        agent_status: agentStatusCheck.agent?.status
                    }
                }),
            })

            if (!retellResponse.ok) {
                const errorData = await retellResponse.text()
                log(`Retell API error (web call): ${errorData}`)
                return new Response(
                    JSON.stringify({ error: 'UPSTREAM_RETELL_ERROR', status: retellResponse.status, traceId }),
                    { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const callData = await retellResponse.json()
            log(`Test web call created: call_id=${callData.call_id}`)

            return new Response(
                JSON.stringify({
                    success: true,
                    call_type: 'web',
                    call_id: callData.call_id,
                    access_token: callData.access_token,
                    agent_status: agentStatusCheck.agent?.status,
                    message: 'Test web call session created',
                    traceId
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        } else if (callType === 'phone') {
            // Get a from number for the call
            const { getOptionalEnv } = await import('../_shared/env.ts')
            const fromNumber = getOptionalEnv('RETELL_FROM_NUMBER')

            if (!fromNumber) {
                log('Missing RETELL_FROM_NUMBER configuration')
                return new Response(
                    JSON.stringify({ error: 'Phone calling not configured', traceId }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const retellResponse = await fetch('https://api.retellai.com/v2/call', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${retellApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    agent_id: agentId,
                    audio_websocket_protocol: 'web',
                    audio_encoding: 'mulaw',
                    sample_rate: 8000,
                    from_number: fromNumber,
                    to_number: phoneNumber,
                    metadata: {
                        organization_id: membership.organization_id,
                        initiated_by: user.id,
                        test_call: true,
                        agent_status: agentStatusCheck.agent?.status
                    }
                }),
            })

            if (!retellResponse.ok) {
                const errorData = await retellResponse.text()
                log(`Retell API error (phone call): ${errorData}`)
                return new Response(
                    JSON.stringify({ error: 'Failed to initiate test call', traceId }),
                    { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const callData = await retellResponse.json()
            log(`Test phone call initiated: call_id=${callData.call_id}`)

            return new Response(
                JSON.stringify({
                    success: true,
                    call_type: 'phone',
                    call_id: callData.call_id,
                    agent_status: agentStatusCheck.agent?.status,
                    message: `Test call initiated to ${phoneNumber}`,
                    traceId
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({ error: 'Invalid call type', traceId }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error(`[${traceId}] Error in test call:`, error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', traceId }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
