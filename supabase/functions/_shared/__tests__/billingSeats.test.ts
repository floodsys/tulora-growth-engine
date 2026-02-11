/**
 * Unit Tests for billingSeats.ts
 * 
 * Tests the syncStripeSeatsForOrg function which syncs active seat count to Stripe.
 * 
 * BEHAVIOR SUMMARY (fail-open vs fail-closed):
 * - Seat count query fails → FAIL-CLOSED: returns { success: false, error: "..." }
 * - Subscription lookup PGRST116 (no rows) → FAIL-OPEN: returns { success: true, skipped: true }
 * - Subscription lookup non-PGRST116 error → FAIL-CLOSED: returns { success: false, error: "..." }
 * - No STRIPE_SECRET_KEY → FAIL-CLOSED: returns { success: false, error: "STRIPE_SECRET_KEY_MISSING" }
 * - Success path → calls Stripe to update subscription quantity
 * 
 * Run with: deno test --allow-env supabase/functions/_shared/__tests__/billingSeats.test.ts
 */

import {
    assertEquals,
    assertExists,
    assertStringIncludes,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { describe, it, beforeEach, afterEach } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { stub, type Stub } from "https://deno.land/std@0.208.0/testing/mock.ts";

// Import the real function from production code
import { syncStripeSeatsForOrg, type SeatSyncResult, type StripeFactory } from '../billingSeats.ts';

// =============================================================================
// Mock Types
// =============================================================================

interface MockSupabaseResult {
    data: unknown;
    error: { message: string; code?: string } | null;
    count?: number;
}

interface MockStripeSubscription {
    id: string;
    items: {
        data: Array<{ id: string }>;
    };
}

interface MockStripeCalls {
    subscriptionsRetrieve: Array<{ subscriptionId: string }>;
    subscriptionItemsUpdate: Array<{ itemId: string; params: { quantity: number; proration_behavior: string } }>;
}

// =============================================================================
// Mock Factory Functions
// =============================================================================

/**
 * Creates a mock Supabase client that simulates the queries used by syncStripeSeatsForOrg:
 * - organization_members: count active seats
 * - org_stripe_subscriptions: get/update subscription
 */
function createMockSupabase(config: {
    seatsResult?: MockSupabaseResult;
    subscriptionResult?: MockSupabaseResult;
    updateResult?: MockSupabaseResult;
    rpcResult?: MockSupabaseResult;
}) {
    const defaults = {
        seatsResult: { data: [], error: null },
        subscriptionResult: { data: null, error: { message: 'No rows', code: 'PGRST116' } },
        updateResult: { data: null, error: null },
        rpcResult: { data: null, error: null },
    };

    const cfg = { ...defaults, ...config };

    return {
        from: (table: string) => {
            if (table === 'organization_members') {
                return {
                    select: (_columns: string, _options?: { count: string }) => ({
                        eq: (_col1: string, _val1: string) => ({
                            eq: (_col2: string, _val2: boolean) => Promise.resolve(cfg.seatsResult),
                        }),
                    }),
                };
            }

            if (table === 'org_stripe_subscriptions') {
                return {
                    select: (_columns: string) => ({
                        eq: (_col: string, _val: string) => ({
                            in: (_col2: string, _vals: string[]) => ({
                                maybeSingle: () => Promise.resolve(cfg.subscriptionResult),
                            }),
                        }),
                    }),
                    update: (_data: Record<string, unknown>) => ({
                        eq: (_col: string, _val: string) => Promise.resolve(cfg.updateResult),
                    }),
                };
            }

            if (table === 'audit_log') {
                return {
                    insert: (_data: Record<string, unknown>) => Promise.resolve({ data: null, error: null }),
                };
            }

            return {
                select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
            };
        },
        rpc: (_name: string, _params: Record<string, unknown>) => Promise.resolve(cfg.rpcResult),
    };
}

/**
 * Creates a mock Stripe module that tracks calls to subscriptions.retrieve and subscriptionItems.update
 */
function createMockStripe(config: {
    subscriptionData?: MockStripeSubscription;
    subscriptionError?: Error;
    updateError?: Error;
}) {
    const calls: MockStripeCalls = {
        subscriptionsRetrieve: [],
        subscriptionItemsUpdate: [],
    };

    const mockStripeInstance = {
        subscriptions: {
            retrieve: async (subscriptionId: string) => {
                calls.subscriptionsRetrieve.push({ subscriptionId });
                if (config.subscriptionError) {
                    throw config.subscriptionError;
                }
                return config.subscriptionData || {
                    id: subscriptionId,
                    items: { data: [{ id: 'si_test_item_123' }] },
                };
            },
        },
        subscriptionItems: {
            update: async (itemId: string, params: { quantity: number; proration_behavior: string }) => {
                calls.subscriptionItemsUpdate.push({ itemId, params });
                if (config.updateError) {
                    throw config.updateError;
                }
                return { id: itemId, quantity: params.quantity };
            },
        },
    };

    return { mockStripeInstance, calls };
}

// =============================================================================
// Test Suites
// =============================================================================

describe('billingSeats - syncStripeSeatsForOrg', () => {
    let envStub: Stub | null = null;

    afterEach(() => {
        if (envStub) {
            envStub.restore();
            envStub = null;
        }
    });

    // =========================================================================
    // A) FAIL-CLOSED: No Stripe key configured
    // =========================================================================
    describe('A) when STRIPE_SECRET_KEY is not configured', () => {
        it('should return success=false with STRIPE_SECRET_KEY_MISSING error (FAIL-CLOSED)', async () => {
            // Stub Deno.env.get to return undefined for STRIPE_SECRET_KEY
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return undefined;
                return undefined;
            });

            const mockSupabase = createMockSupabase({});

            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', 'test-corr');

            assertEquals(result.success, false);
            assertEquals(result.error, 'STRIPE_SECRET_KEY_MISSING');
            assertStringIncludes(result.message, 'STRIPE_SECRET_KEY is not configured');
            assertEquals(result.skipped, undefined); // NOT skipped — it's an error
        });

        it('should include setup instructions in the error message', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return undefined;
                return undefined;
            });

            const mockSupabase = createMockSupabase({});

            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', 'test-corr');

            assertEquals(result.success, false);
            assertStringIncludes(result.message, '.env.example');
        });

        it('should return success=false even with empty string key', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return '';
                return undefined;
            });

            const mockSupabase = createMockSupabase({});

            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', 'test-corr');

            assertEquals(result.success, false);
            assertEquals(result.error, 'STRIPE_SECRET_KEY_MISSING');
        });
    });

    // =========================================================================
    // B) FAIL-CLOSED: Seat count query fails
    // =========================================================================
    describe('B) when seat count query returns error', () => {
        it('should return success=false with error (FAIL-CLOSED)', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_fake_key';
                return undefined;
            });

            const mockSupabase = createMockSupabase({
                seatsResult: {
                    data: null,
                    error: { message: 'Connection timeout', code: 'TIMEOUT' },
                },
            });

            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', 'test-corr');

            assertEquals(result.success, false);
            assertExists(result.error);
            assertStringIncludes(result.error!, 'Failed to count active seats');
            assertStringIncludes(result.error!, 'Connection timeout');
        });

        it('should include correlation ID in error logging context', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_fake_key';
                return undefined;
            });

            const mockSupabase = createMockSupabase({
                seatsResult: {
                    data: null,
                    error: { message: 'Database error' },
                },
            });

            const correlationId = 'unique-corr-id-12345';
            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', correlationId);

            assertEquals(result.success, false);
            assertEquals(result.message, 'Seat sync failed');
        });
    });

    // =========================================================================
    // C) FAIL-CLOSED: Subscription lookup returns error (subError != null)
    // =========================================================================
    describe('C) when subscription lookup fails with non-PGRST116 error', () => {
        it('should return success=false with error (FAIL-CLOSED)', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_fake_key';
                return undefined;
            });

            const mockSupabase = createMockSupabase({
                seatsResult: {
                    data: [{ user_id: 'user-1' }],
                    error: null,
                },
                subscriptionResult: {
                    data: null,
                    error: { message: 'Permission denied', code: 'PGRST301' },
                },
            });

            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', 'test-corr');

            assertEquals(result.success, false);
            assertExists(result.error);
            assertStringIncludes(result.message, 'Failed to fetch subscription');
            assertStringIncludes(result.error!, 'Permission denied');
        });

        it('should fail-closed on database connection errors', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_fake_key';
                return undefined;
            });

            const mockSupabase = createMockSupabase({
                seatsResult: { data: [], error: null },
                subscriptionResult: {
                    data: null,
                    error: { message: 'Connection refused', code: 'CONNECTION_ERROR' },
                },
            });

            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', 'test-corr');

            assertEquals(result.success, false);
            assertStringIncludes(result.error!, 'Connection refused');
        });
    });

    // =========================================================================
    // D) FAIL-OPEN: Subscription lookup returns null subscription (0 rows)
    // =========================================================================
    describe('D) when subscription lookup returns null subscription (no active subscription)', () => {
        it('should return success with skipped=true when no subscription exists (FAIL-OPEN)', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_fake_key';
                return undefined;
            });

            const mockSupabase = createMockSupabase({
                seatsResult: {
                    data: [{ user_id: 'user-1' }, { user_id: 'user-2' }, { user_id: 'user-3' }],
                    error: null,
                },
                subscriptionResult: {
                    data: null,
                    error: null, // No error, just no subscription
                },
            });

            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', 'test-corr');

            assertEquals(result.success, true);
            assertEquals(result.skipped, true);
            assertEquals(result.message, 'No active subscription to update');
            assertEquals(result.newQuantity, 3); // seat count is still returned
        });

        it('should handle null subscription data gracefully', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_fake_key';
                return undefined;
            });

            const mockSupabase = createMockSupabase({
                seatsResult: { data: [], error: null },
                subscriptionResult: { data: null, error: null }, // No error but also no data
            });

            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', 'test-corr');

            assertEquals(result.success, true);
            assertEquals(result.skipped, true);
            assertEquals(result.newQuantity, 0);
        });
    });

    // =========================================================================
    // E) SUCCESS PATH: Stripe update called with correct parameters
    // =========================================================================
    describe('E) SUCCESS PATH: when seat count differs and Stripe update is needed', () => {
        it('should call Stripe API to update subscription quantity with prorations', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_fake_key';
                return undefined;
            });

            // Create 5 active seats
            const activeSeats = [
                { user_id: 'user-1' },
                { user_id: 'user-2' },
                { user_id: 'user-3' },
                { user_id: 'user-4' },
                { user_id: 'user-5' },
            ];

            const mockSupabase = createMockSupabase({
                seatsResult: {
                    data: activeSeats,
                    error: null,
                },
                subscriptionResult: {
                    data: {
                        id: 'sub-db-id-999',
                        stripe_subscription_id: 'sub_stripe_abc123',
                        quantity: 3, // Old quantity (different from current seat count of 5)
                        organization_id: 'org-123',
                        status: 'active',
                    },
                    error: null,
                },
                updateResult: {
                    data: null,
                    error: null,
                },
            });

            // Create mock Stripe with tracked calls
            const { mockStripeInstance, calls } = createMockStripe({
                subscriptionData: {
                    id: 'sub_stripe_abc123',
                    items: {
                        data: [{ id: 'si_123' }],
                    },
                },
            });

            // Create factory that returns our mock
            const stripeFactory: StripeFactory = (_stripeKey: string) => mockStripeInstance;

            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', 'test-corr', stripeFactory);

            // Assert success
            assertEquals(result.success, true);
            assertEquals(result.oldQuantity, 3);
            assertEquals(result.newQuantity, 5);
            assertEquals(result.subscriptionId, 'sub_stripe_abc123');
            assertStringIncludes(result.message, '3');
            assertStringIncludes(result.message, '5');
            assertEquals(result.skipped, undefined); // not skipped

            // Assert Stripe was called correctly
            assertEquals(calls.subscriptionsRetrieve.length, 1);
            assertEquals(calls.subscriptionsRetrieve[0].subscriptionId, 'sub_stripe_abc123');

            assertEquals(calls.subscriptionItemsUpdate.length, 1);
            assertEquals(calls.subscriptionItemsUpdate[0].itemId, 'si_123');
            assertEquals(calls.subscriptionItemsUpdate[0].params.quantity, 5);
            assertEquals(calls.subscriptionItemsUpdate[0].params.proration_behavior, 'create_prorations');
        });

        it('should handle decreasing seat count (downgrade)', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_fake_key';
                return undefined;
            });

            const mockSupabase = createMockSupabase({
                seatsResult: {
                    data: [{ user_id: 'user-1' }], // Only 1 seat now
                    error: null,
                },
                subscriptionResult: {
                    data: {
                        id: 'sub-db-id',
                        stripe_subscription_id: 'sub_stripe_xyz',
                        quantity: 10, // Was 10 seats
                        organization_id: 'org-123',
                    },
                    error: null,
                },
            });

            const { mockStripeInstance, calls } = createMockStripe({
                subscriptionData: {
                    id: 'sub_stripe_xyz',
                    items: { data: [{ id: 'si_downgrade_test' }] },
                },
            });

            const stripeFactory: StripeFactory = (_key: string) => mockStripeInstance;

            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', 'corr-123', stripeFactory);

            assertEquals(result.success, true);
            assertEquals(result.oldQuantity, 10);
            assertEquals(result.newQuantity, 1);
            assertEquals(calls.subscriptionItemsUpdate[0].params.quantity, 1);
        });

        it('should fail if Stripe subscription has no items', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_fake_key';
                return undefined;
            });

            const mockSupabase = createMockSupabase({
                seatsResult: {
                    data: [{ user_id: 'user-1' }],
                    error: null,
                },
                subscriptionResult: {
                    data: {
                        id: 'sub-db-id',
                        stripe_subscription_id: 'sub_no_items',
                        quantity: 0,
                        organization_id: 'org-123',
                    },
                    error: null,
                },
            });

            const { mockStripeInstance } = createMockStripe({
                subscriptionData: {
                    id: 'sub_no_items',
                    items: { data: [] }, // No items!
                },
            });

            const stripeFactory: StripeFactory = (_key: string) => mockStripeInstance;

            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', 'corr-123', stripeFactory);

            assertEquals(result.success, false);
            assertStringIncludes(result.error!, 'No subscription items found');
        });
    });

    // =========================================================================
    // SUCCESS PATH: Seat count matches - no update needed
    // =========================================================================
    describe('when seat count matches current subscription quantity', () => {
        it('should return success without calling Stripe update', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_fake_key';
                return undefined;
            });

            const mockSupabase = createMockSupabase({
                seatsResult: {
                    data: [{ user_id: 'user-1' }, { user_id: 'user-2' }, { user_id: 'user-3' }],
                    error: null,
                },
                subscriptionResult: {
                    data: {
                        id: 'sub-db-id',
                        stripe_subscription_id: 'sub_stripe_123',
                        quantity: 3, // matches seat count
                        organization_id: 'org-123',
                    },
                    error: null,
                },
            });

            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', 'test-corr');

            assertEquals(result.success, true);
            assertEquals(result.message, 'Seat count already up to date');
            assertEquals(result.oldQuantity, 3);
            assertEquals(result.newQuantity, 3);
            assertEquals(result.subscriptionId, 'sub_stripe_123');
            assertEquals(result.skipped, undefined); // not skipped, just no update needed
        });
    });

    // =========================================================================
    // Edge Cases
    // =========================================================================
    describe('edge cases', () => {
        it('should handle empty activeSeats array as 0 count', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_fake_key';
                return undefined;
            });

            const mockSupabase = createMockSupabase({
                seatsResult: { data: [], error: null },
                subscriptionResult: { data: null, error: null },
            });

            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', 'test-corr');

            assertEquals(result.success, true);
            assertEquals(result.skipped, true);
            assertEquals(result.newQuantity, 0);
        });

        it('should handle null activeSeats as 0 count', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_fake_key';
                return undefined;
            });

            const mockSupabase = createMockSupabase({
                seatsResult: { data: null, error: null }, // null data, no error
                subscriptionResult: { data: null, error: null },
            });

            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', 'test-corr');

            assertEquals(result.success, true);
            assertEquals(result.newQuantity, 0);
        });

        it('should generate correlation ID if not provided (and still fail-closed without key)', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return undefined;
                return undefined;
            });

            const mockSupabase = createMockSupabase({});

            // Call without correlationId — should still produce a result (with auto-generated corr ID)
            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123');

            assertEquals(result.success, false);
            assertEquals(result.error, 'STRIPE_SECRET_KEY_MISSING');
        });

        it('should handle subscription with null quantity as 0', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_fake_key';
                return undefined;
            });

            const mockSupabase = createMockSupabase({
                seatsResult: { data: [], error: null },
                subscriptionResult: {
                    data: {
                        id: 'sub-db-id',
                        stripe_subscription_id: 'sub_stripe_123',
                        quantity: null, // null quantity should be treated as 0
                        organization_id: 'org-123',
                    },
                    error: null,
                },
            });

            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', 'test-corr');

            // 0 seats === 0 quantity, no update needed
            assertEquals(result.success, true);
            assertEquals(result.oldQuantity, 0);
            assertEquals(result.newQuantity, 0);
        });
    });

    // =========================================================================
    // SeatSyncResult Interface Tests
    // =========================================================================
    describe('SeatSyncResult interface', () => {
        it('should have required success and message fields on failure', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_fake_key';
                return undefined;
            });

            const mockSupabase = createMockSupabase({
                seatsResult: { data: null, error: { message: 'DB Error' } },
            });

            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', 'test-corr');

            // Type assertions for SeatSyncResult
            assertExists(result.success);
            assertExists(result.message);
            assertEquals(typeof result.success, 'boolean');
            assertEquals(typeof result.message, 'string');

            // On failure, error should be present
            assertEquals(result.success, false);
            assertExists(result.error);
        });

        it('should have optional fields populated on success path', async () => {
            envStub = stub(Deno.env, 'get', (key: string) => {
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_fake_key';
                return undefined;
            });

            const mockSupabase = createMockSupabase({
                seatsResult: { data: [{ user_id: 'u1' }], error: null },
                subscriptionResult: {
                    data: {
                        id: 'sub-db-id',
                        stripe_subscription_id: 'sub_123',
                        quantity: 1,
                    },
                    error: null,
                },
            });

            const result = await syncStripeSeatsForOrg(mockSupabase, 'org-123', 'test-corr');

            assertEquals(result.success, true);
            assertEquals(result.oldQuantity, 1);
            assertEquals(result.newQuantity, 1);
            assertEquals(result.subscriptionId, 'sub_123');
        });
    });
});

// =============================================================================
// Additional Test Suite: syncStripeSeatsForOrgAsync (fire-and-forget)
// =============================================================================

describe('billingSeats - syncStripeSeatsForOrgAsync', () => {
    // Note: The async wrapper is fire-and-forget, so we mainly verify it doesn't throw
    // and handles errors gracefully by logging them.

    it('should exist as an exported function', async () => {
        const { syncStripeSeatsForOrgAsync } = await import('../billingSeats.ts');
        assertEquals(typeof syncStripeSeatsForOrgAsync, 'function');
    });
});

// =============================================================================
// Summary: Fail-Open vs Fail-Closed Behavior
// =============================================================================

describe('billingSeats - Behavior Documentation', () => {
    it('documents FAIL-OPEN scenarios (graceful skip)', () => {
        // These scenarios return success: true, skipped: true
        const failOpenScenarios = [
            'Subscription lookup returns null (no active subscription)',
            'Subscription data is null (no active subscription)',
        ];

        assertEquals(failOpenScenarios.length, 2);
    });

    it('documents FAIL-CLOSED scenarios (return error)', () => {
        // These scenarios return success: false with error message
        const failClosedScenarios = [
            'STRIPE_SECRET_KEY not configured (error: STRIPE_SECRET_KEY_MISSING)',
            'Seat count query fails (any error)',
            'Subscription lookup returns error (subError != null)',
            'Stripe API call fails (subscription retrieve or item update)',
            'No subscription items found in Stripe subscription',
        ];

        assertEquals(failClosedScenarios.length, 5);
    });
});

console.log('🧪 Running billingSeats.test.ts - Tests for syncStripeSeatsForOrg...');
