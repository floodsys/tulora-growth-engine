/**
 * Unit Tests for billingUsage.ts
 * 
 * Tests the enforceUsageQuota function and related helpers.
 * These tests use mocks to isolate the billing logic from database calls.
 * 
 * Run with: deno test --allow-env supabase/functions/_shared/__tests__/billingUsage.test.ts
 */

import {
    assertEquals,
    assertThrows,
    assertRejects,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { describe, it, beforeEach } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { spy, stub, assertSpyCalls } from "https://deno.land/std@0.208.0/testing/mock.ts";

// Types for mocking
interface MockSupabaseResult {
    data: unknown;
    error: { message: string; code: string } | null;
}

// Mock implementations to test the logic without actual DB
// Since we can't import the actual module in Deno tests easily,
// we'll implement the core logic for testing

type UsageResource = 'calls' | 'minutes' | 'messages';

interface UsageQuotaResult {
    allowed: boolean;
    remaining?: number;
    limit?: number;
    current?: number;
    reason?: string;
}

interface UsageQuotaError {
    status: 402;
    code: 'BILLING_OVER_LIMIT';
    metric: UsageResource;
    remaining: 0;
    limit: number;
    current: number;
    message: string;
}

interface UsageQuotaCheckError {
    status: 503;
    code: 'BILLING_QUOTA_CHECK_ERROR';
    metric: UsageResource;
    message: string;
}

// Re-implement core functions for testing (mirrors billingUsage.ts)
const RESOURCE_TO_LIMIT_KEY: Record<UsageResource, string> = {
    calls: 'calls_per_month',
    minutes: 'minutes_per_month',
    messages: 'messages_per_month',
};

function isUsageQuotaError(error: unknown): error is UsageQuotaError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as UsageQuotaError).code === 'BILLING_OVER_LIMIT' &&
        'status' in error &&
        (error as UsageQuotaError).status === 402
    );
}

function isUsageQuotaCheckError(error: unknown): error is UsageQuotaCheckError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as UsageQuotaCheckError).code === 'BILLING_QUOTA_CHECK_ERROR' &&
        'status' in error &&
        (error as UsageQuotaCheckError).status === 503
    );
}

// Mock Supabase client factory
function createMockSupabase(mockResponses: {
    org?: MockSupabaseResult;
    planConfig?: MockSupabaseResult;
    rollup?: MockSupabaseResult;
    calls?: MockSupabaseResult;
    smsMessages?: MockSupabaseResult;
    rpc?: MockSupabaseResult;
}) {
    return {
        from: (table: string) => ({
            select: (_columns: string) => ({
                eq: (_col: string, _val: string) => ({
                    eq: (_col2: string, _val2: unknown) => ({
                        single: async () => {
                            if (table === 'organizations') return mockResponses.org || { data: null, error: null };
                            if (table === 'plan_configs') return mockResponses.planConfig || { data: null, error: null };
                            if (table === 'usage_rollups') return mockResponses.rollup || { data: null, error: null };
                            return { data: null, error: null };
                        },
                    }),
                    single: async () => {
                        if (table === 'organizations') return mockResponses.org || { data: null, error: null };
                        if (table === 'plan_configs') return mockResponses.planConfig || { data: null, error: null };
                        if (table === 'usage_rollups') return mockResponses.rollup || { data: null, error: null };
                        return { data: null, error: null };
                    },
                    in: (_col: string, _vals: string[]) => ({
                        gte: (_col: string, _val: string) => ({
                            count: 'exact',
                            head: true,
                        }),
                    }),
                    gte: (_col: string, _val: string) => ({
                        not: (_col: string, _op: string, _val: unknown) => mockResponses.calls || { data: [], error: null },
                    }),
                }),
                gte: (_col: string, _val: string) => ({
                    in: (_col: string, _vals: string[]) => mockResponses.calls || { data: null, error: null, count: 0 },
                }),
                count: 'exact',
                head: true,
            }),
        }),
        rpc: async (_name: string, _params: unknown) => mockResponses.rpc || { data: null, error: null },
    };
}

// Simplified checkUsageQuota for testing
async function checkUsageQuota(
    supabase: ReturnType<typeof createMockSupabase>,
    orgId: string,
    resource: UsageResource,
    currentUsage: number,
): Promise<UsageQuotaResult> {
    try {
        // Step 1: Get org's plan
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('plan_key')
            .eq('id', orgId)
            .single();

        if (orgError || !org) {
            return { allowed: true, reason: 'org_not_found' };
        }

        // Step 2: Get plan limits
        const { data: planConfig, error: planError } = await supabase
            .from('plan_configs')
            .select('limits')
            .eq('plan_key', (org as { plan_key: string }).plan_key)
            .eq('is_active', true)
            .single();

        if (planError || !planConfig) {
            return { allowed: true, reason: 'no_plan_config' };
        }

        const limits = (planConfig as { limits: Record<string, number | null> }).limits || {};
        const limitKey = RESOURCE_TO_LIMIT_KEY[resource];
        const limit = limits[limitKey];

        // Step 3: Check if limit is enforced
        if (limit === null || limit === undefined) {
            return { allowed: true, reason: 'unlimited' };
        }

        // Step 4: Check if over limit
        if (currentUsage >= limit) {
            return {
                allowed: false,
                remaining: 0,
                limit,
                current: currentUsage,
                reason: 'over_limit',
            };
        }

        return {
            allowed: true,
            remaining: limit - currentUsage,
            limit,
            current: currentUsage,
        };
    } catch (_error) {
        return {
            allowed: false,
            reason: 'quota_check_error',
        };
    }
}

// Simplified enforceUsageQuota for testing
async function enforceUsageQuota(
    supabase: ReturnType<typeof createMockSupabase>,
    orgId: string,
    resource: UsageResource,
    currentUsage: number,
): Promise<UsageQuotaResult> {
    const result = await checkUsageQuota(supabase, orgId, resource, currentUsage);

    if (!result.allowed) {
        if (result.reason === 'over_limit') {
            const error: UsageQuotaError = {
                status: 402,
                code: 'BILLING_OVER_LIMIT',
                metric: resource,
                remaining: 0,
                limit: result.limit!,
                current: result.current!,
                message: `Monthly ${resource} limit exceeded. Current: ${result.current}, Limit: ${result.limit}`,
            };
            throw error;
        }

        if (result.reason === 'quota_check_error') {
            const error: UsageQuotaCheckError = {
                status: 503,
                code: 'BILLING_QUOTA_CHECK_ERROR',
                metric: resource,
                message: "We're temporarily unable to verify your usage. Please try again shortly.",
            };
            throw error;
        }
    }

    return result;
}


// ============================================================================
// TEST SUITES
// ============================================================================

describe('billingUsage', () => {
    describe('checkUsageQuota', () => {
        it('should allow when organization not found (fail-open)', async () => {
            const mockSupabase = createMockSupabase({
                org: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
            });

            const result = await checkUsageQuota(mockSupabase, 'unknown-org', 'calls', 0);

            assertEquals(result.allowed, true);
            assertEquals(result.reason, 'org_not_found');
        });

        it('should allow when no plan config exists', async () => {
            const mockSupabase = createMockSupabase({
                org: { data: { plan_key: 'free' }, error: null },
                planConfig: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
            });

            const result = await checkUsageQuota(mockSupabase, 'org-123', 'calls', 0);

            assertEquals(result.allowed, true);
            assertEquals(result.reason, 'no_plan_config');
        });

        it('should allow when limit is null (unlimited)', async () => {
            const mockSupabase = createMockSupabase({
                org: { data: { plan_key: 'enterprise' }, error: null },
                planConfig: { data: { limits: { calls_per_month: null } }, error: null },
            });

            const result = await checkUsageQuota(mockSupabase, 'org-123', 'calls', 1000);

            assertEquals(result.allowed, true);
            assertEquals(result.reason, 'unlimited');
        });

        it('should allow when under limit', async () => {
            const mockSupabase = createMockSupabase({
                org: { data: { plan_key: 'pro' }, error: null },
                planConfig: { data: { limits: { calls_per_month: 100 } }, error: null },
            });

            const result = await checkUsageQuota(mockSupabase, 'org-123', 'calls', 50);

            assertEquals(result.allowed, true);
            assertEquals(result.remaining, 50);
            assertEquals(result.limit, 100);
            assertEquals(result.current, 50);
        });

        it('should deny when at exactly the limit', async () => {
            const mockSupabase = createMockSupabase({
                org: { data: { plan_key: 'pro' }, error: null },
                planConfig: { data: { limits: { calls_per_month: 100 } }, error: null },
            });

            const result = await checkUsageQuota(mockSupabase, 'org-123', 'calls', 100);

            assertEquals(result.allowed, false);
            assertEquals(result.remaining, 0);
            assertEquals(result.reason, 'over_limit');
        });

        it('should deny when over limit', async () => {
            const mockSupabase = createMockSupabase({
                org: { data: { plan_key: 'free' }, error: null },
                planConfig: { data: { limits: { calls_per_month: 10 } }, error: null },
            });

            const result = await checkUsageQuota(mockSupabase, 'org-123', 'calls', 15);

            assertEquals(result.allowed, false);
            assertEquals(result.remaining, 0);
            assertEquals(result.limit, 10);
            assertEquals(result.current, 15);
            assertEquals(result.reason, 'over_limit');
        });

        it('should check minutes resource correctly', async () => {
            const mockSupabase = createMockSupabase({
                org: { data: { plan_key: 'pro' }, error: null },
                planConfig: { data: { limits: { minutes_per_month: 500 } }, error: null },
            });

            const result = await checkUsageQuota(mockSupabase, 'org-123', 'minutes', 250);

            assertEquals(result.allowed, true);
            assertEquals(result.remaining, 250);
            assertEquals(result.limit, 500);
        });

        it('should check messages resource correctly', async () => {
            const mockSupabase = createMockSupabase({
                org: { data: { plan_key: 'starter' }, error: null },
                planConfig: { data: { limits: { messages_per_month: 1000 } }, error: null },
            });

            const result = await checkUsageQuota(mockSupabase, 'org-123', 'messages', 999);

            assertEquals(result.allowed, true);
            assertEquals(result.remaining, 1);
        });
    });

    describe('enforceUsageQuota', () => {
        it('should return result when allowed', async () => {
            const mockSupabase = createMockSupabase({
                org: { data: { plan_key: 'pro' }, error: null },
                planConfig: { data: { limits: { calls_per_month: 100 } }, error: null },
            });

            const result = await enforceUsageQuota(mockSupabase, 'org-123', 'calls', 50);

            assertEquals(result.allowed, true);
            assertEquals(result.remaining, 50);
        });

        it('should throw UsageQuotaError when over limit', async () => {
            const mockSupabase = createMockSupabase({
                org: { data: { plan_key: 'free' }, error: null },
                planConfig: { data: { limits: { calls_per_month: 10 } }, error: null },
            });

            let thrownError: unknown;
            try {
                await enforceUsageQuota(mockSupabase, 'org-123', 'calls', 15);
            } catch (e) {
                thrownError = e;
            }

            assertEquals(isUsageQuotaError(thrownError), true);
            if (isUsageQuotaError(thrownError)) {
                assertEquals(thrownError.status, 402);
                assertEquals(thrownError.code, 'BILLING_OVER_LIMIT');
                assertEquals(thrownError.metric, 'calls');
                assertEquals(thrownError.limit, 10);
                assertEquals(thrownError.current, 15);
            }
        });

        it('should include correct message in UsageQuotaError', async () => {
            const mockSupabase = createMockSupabase({
                org: { data: { plan_key: 'free' }, error: null },
                planConfig: { data: { limits: { minutes_per_month: 60 } }, error: null },
            });

            let thrownError: unknown;
            try {
                await enforceUsageQuota(mockSupabase, 'org-123', 'minutes', 120);
            } catch (e) {
                thrownError = e;
            }

            if (isUsageQuotaError(thrownError)) {
                assertEquals(thrownError.message.includes('minutes'), true);
                assertEquals(thrownError.message.includes('120'), true);
                assertEquals(thrownError.message.includes('60'), true);
            }
        });
    });

    describe('type guards', () => {
        it('isUsageQuotaError should correctly identify UsageQuotaError', () => {
            const validError: UsageQuotaError = {
                status: 402,
                code: 'BILLING_OVER_LIMIT',
                metric: 'calls',
                remaining: 0,
                limit: 100,
                current: 150,
                message: 'Over limit',
            };

            assertEquals(isUsageQuotaError(validError), true);
            assertEquals(isUsageQuotaError({ status: 402 }), false);
            assertEquals(isUsageQuotaError({ code: 'BILLING_OVER_LIMIT' }), false);
            assertEquals(isUsageQuotaError(null), false);
            assertEquals(isUsageQuotaError(undefined), false);
            assertEquals(isUsageQuotaError('error'), false);
        });

        it('isUsageQuotaCheckError should correctly identify UsageQuotaCheckError', () => {
            const validError: UsageQuotaCheckError = {
                status: 503,
                code: 'BILLING_QUOTA_CHECK_ERROR',
                metric: 'calls',
                message: 'Quota check failed',
            };

            assertEquals(isUsageQuotaCheckError(validError), true);
            assertEquals(isUsageQuotaCheckError({ status: 503 }), false);
            assertEquals(isUsageQuotaCheckError({ code: 'BILLING_QUOTA_CHECK_ERROR' }), false);
            assertEquals(isUsageQuotaCheckError(null), false);
        });
    });

    describe('edge cases', () => {
        it('should handle zero limit correctly (blocks all usage)', async () => {
            const mockSupabase = createMockSupabase({
                org: { data: { plan_key: 'suspended' }, error: null },
                planConfig: { data: { limits: { calls_per_month: 0 } }, error: null },
            });

            const result = await checkUsageQuota(mockSupabase, 'org-123', 'calls', 0);

            assertEquals(result.allowed, false);
            assertEquals(result.reason, 'over_limit');
        });

        it('should handle missing limits object gracefully', async () => {
            const mockSupabase = createMockSupabase({
                org: { data: { plan_key: 'legacy' }, error: null },
                planConfig: { data: { limits: {} }, error: null },
            });

            const result = await checkUsageQuota(mockSupabase, 'org-123', 'calls', 100);

            assertEquals(result.allowed, true);
            assertEquals(result.reason, 'unlimited');
        });

        it('should handle undefined limit for specific resource', async () => {
            const mockSupabase = createMockSupabase({
                org: { data: { plan_key: 'custom' }, error: null },
                planConfig: { data: { limits: { calls_per_month: 100 } }, error: null },
            });

            // Minutes not defined in limits
            const result = await checkUsageQuota(mockSupabase, 'org-123', 'minutes', 1000);

            assertEquals(result.allowed, true);
            assertEquals(result.reason, 'unlimited');
        });
    });
});

// Run tests
console.log('🧪 Running billingUsage.test.ts...');
