import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { requireSuperadmin } from '../_shared/requireSuperadmin.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

/**
 * admin-observability-metrics
 * 
 * Returns real operational metrics for admin observability dashboards.
 * Requires superadmin authentication (verify_jwt = true).
 * 
 * Response schema:
 * {
 *   generated_at: string (ISO),
 *   retell_webhooks: {
 *     last_1h: { total: number, by_type: Record<string, number> },
 *     last_24h: { total: number, by_type: Record<string, number> }
 *   },
 *   stripe_webhooks: {
 *     last_1h: { total: number, by_type: Record<string, number> },
 *     last_24h: { total: number, by_type: Record<string, number> }
 *   },
 *   failures: {
 *     last_1h: number,
 *     last_24h: number,
 *     recent_errors: Array<{ id, action, error_code, target_type, created_at }>
 *   },
 *   latency: {
 *     call_p50_ms: number | null,
 *     call_p95_ms: number | null,
 *     sample_size: number
 *   },
 *   calls: {
 *     active: number,
 *     total_24h: number,
 *     failed_24h: number
 *   }
 * }
 */
Deno.serve(async (req) => {
    const corsHeaders = getCorsHeaders(req);
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    // Only GET is supported
    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Enforce superadmin access
    const guardResult = await requireSuperadmin(req, 'admin-observability-metrics');
    if (!guardResult.ok) {
        return guardResult.response!;
    }

    try {
        // Service role client for cross-org aggregation
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { persistSession: false } }
        );

        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        // Run all queries in parallel
        const [
            retellWebhooks1h,
            retellWebhooks24h,
            stripeWebhooks1h,
            stripeWebhooks24h,
            failures1h,
            failures24h,
            recentErrors,
            latencyData,
            activeCalls,
            totalCalls24h,
            failedCalls24h,
        ] = await Promise.all([
            // Retell webhook events last 1h
            supabase
                .from('webhook_events')
                .select('event_type')
                .gte('created_at', oneHourAgo),

            // Retell webhook events last 24h
            supabase
                .from('webhook_events')
                .select('event_type')
                .gte('created_at', twentyFourHoursAgo),

            // Stripe processed webhook events last 1h
            supabase
                .from('processed_webhook_events')
                .select('event_type')
                .gte('processed_at', oneHourAgo),

            // Stripe processed webhook events last 24h
            supabase
                .from('processed_webhook_events')
                .select('event_type')
                .gte('processed_at', twentyFourHoursAgo),

            // Activity log failures last 1h
            supabase
                .from('activity_logs')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'error')
                .gte('created_at', oneHourAgo),

            // Activity log failures last 24h
            supabase
                .from('activity_logs')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'error')
                .gte('created_at', twentyFourHoursAgo),

            // Recent error rows (last 10)
            supabase
                .from('activity_logs')
                .select('id, action, error_code, target_type, created_at')
                .eq('status', 'error')
                .order('created_at', { ascending: false })
                .limit(10),

            // Latency: completed retell calls with duration in last 24h
            supabase
                .from('retell_calls')
                .select('duration_ms')
                .eq('status', 'completed')
                .not('duration_ms', 'is', null)
                .gte('created_at', twentyFourHoursAgo)
                .order('duration_ms', { ascending: true }),

            // Active calls (ongoing/started)
            supabase
                .from('retell_calls')
                .select('id', { count: 'exact', head: true })
                .in('status', ['started', 'ongoing']),

            // Total calls last 24h
            supabase
                .from('retell_calls')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', twentyFourHoursAgo),

            // Failed calls last 24h
            supabase
                .from('retell_calls')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'failed')
                .gte('created_at', twentyFourHoursAgo),
        ]);

        // Aggregate retell webhooks by type
        const aggregateByType = (rows: { event_type: string }[] | null): Record<string, number> => {
            const byType: Record<string, number> = {};
            for (const row of rows ?? []) {
                byType[row.event_type] = (byType[row.event_type] || 0) + 1;
            }
            return byType;
        };

        // Compute latency percentiles
        const durations = (latencyData.data ?? [])
            .map((r: { duration_ms: number }) => r.duration_ms)
            .filter((d: number) => d > 0);

        const percentile = (sorted: number[], p: number): number | null => {
            if (sorted.length === 0) return null;
            const idx = Math.ceil((p / 100) * sorted.length) - 1;
            return sorted[Math.max(0, idx)];
        };

        const response = {
            generated_at: now.toISOString(),
            retell_webhooks: {
                last_1h: {
                    total: retellWebhooks1h.data?.length ?? 0,
                    by_type: aggregateByType(retellWebhooks1h.data),
                },
                last_24h: {
                    total: retellWebhooks24h.data?.length ?? 0,
                    by_type: aggregateByType(retellWebhooks24h.data),
                },
            },
            stripe_webhooks: {
                last_1h: {
                    total: stripeWebhooks1h.data?.length ?? 0,
                    by_type: aggregateByType(stripeWebhooks1h.data),
                },
                last_24h: {
                    total: stripeWebhooks24h.data?.length ?? 0,
                    by_type: aggregateByType(stripeWebhooks24h.data),
                },
            },
            failures: {
                last_1h: failures1h.count ?? 0,
                last_24h: failures24h.count ?? 0,
                recent_errors: (recentErrors.data ?? []).map((e: any) => ({
                    id: e.id,
                    action: e.action,
                    error_code: e.error_code,
                    target_type: e.target_type,
                    created_at: e.created_at,
                })),
            },
            latency: {
                call_p50_ms: percentile(durations, 50),
                call_p95_ms: percentile(durations, 95),
                sample_size: durations.length,
            },
            calls: {
                active: activeCalls.count ?? 0,
                total_24h: totalCalls24h.count ?? 0,
                failed_24h: failedCalls24h.count ?? 0,
            },
        };

        return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error in admin-observability-metrics:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
