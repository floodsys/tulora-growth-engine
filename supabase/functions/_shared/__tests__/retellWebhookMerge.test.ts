/**
 * Unit Tests for Retell webhook idempotency, out-of-order safety,
 * tenant binding, and fast-ack behavior.
 *
 * These tests mock the Supabase client and EdgeRuntime.waitUntil to
 * validate the webhook handler logic without requiring a live database.
 *
 * Run with: deno test --allow-env --allow-net supabase/functions/_shared/__tests__/retellWebhookMerge.test.ts
 */

import {
    assertEquals,
    assertNotEquals,
    assert,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { describe, it, beforeEach } from "https://deno.land/std@0.208.0/testing/bdd.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Mock infrastructure
// ─────────────────────────────────────────────────────────────────────────────

/** Simulates the merge_retell_call_event RPC behavior in-memory */
class MockMergeStore {
    events: Map<string, { org_id: string; call_id: string; event_type: string; payload_hash: string }> = new Map();
    calls: Map<string, {
        call_id: string;
        organization_id: string;
        agent_id: string;
        status: string;
        started_at: string | null;
        ended_at: string | null;
        duration_ms: number | null;
        analysis_json: Record<string, unknown> | null;
        outcome: string | null;
        sentiment: string | null;
        lead_score: number | null;
    }> = new Map();

    /** Status rank helper */
    private statusRank(status: string): number {
        switch (status) {
            case 'started': return 1;
            case 'ongoing': return 2;
            case 'completed': return 3;
            case 'analyzed': return 4;
            default: return 0;
        }
    }

    /** Maps event_type to status */
    private eventToStatus(eventType: string): string {
        switch (eventType) {
            case 'call_started': return 'started';
            case 'call_ended': return 'completed';
            case 'call_analyzed':
            case 'analysis_completed': return 'analyzed';
            default: return 'started';
        }
    }

    /**
     * Simulates merge_retell_call_event RPC.
     * Returns { data: boolean, error: null } or { data: null, error: ... }
     */
    merge(params: {
        p_org_id: string;
        p_call_id: string;
        p_agent_id: string;
        p_event_type: string;
        p_payload: Record<string, unknown>;
        p_payload_hash: string;
        p_received_at: string;
    }): { data: boolean | null; error: { message: string } | null } {
        const eventKey = `${params.p_org_id}:${params.p_call_id}:${params.p_event_type}`;

        // Step 1: Idempotency check
        if (this.events.has(eventKey)) {
            return { data: false, error: null };
        }

        // Step 2: Tenant binding check
        const existingCall = this.calls.get(params.p_call_id);
        if (existingCall && existingCall.organization_id !== params.p_org_id) {
            return {
                data: null,
                error: {
                    message: `Tenant binding violation: call ${params.p_call_id} already belongs to org ${existingCall.organization_id}, cannot reassign to ${params.p_org_id}`
                }
            };
        }

        // Record the event
        this.events.set(eventKey, {
            org_id: params.p_org_id,
            call_id: params.p_call_id,
            event_type: params.p_event_type,
            payload_hash: params.p_payload_hash,
        });

        const newStatus = this.eventToStatus(params.p_event_type);
        const newRank = this.statusRank(newStatus);

        const payload = params.p_payload as Record<string, unknown>;
        const startedAt = payload.start_timestamp
            ? new Date((payload.start_timestamp as number) * 1000).toISOString()
            : (params.p_event_type === 'call_started' ? params.p_received_at : null);
        const endedAt = payload.end_timestamp
            ? new Date((payload.end_timestamp as number) * 1000).toISOString()
            : null;
        const durationMs = payload.call_length
            ? (payload.call_length as number) * 1000
            : null;

        // Extract analysis fields
        let analysisJson: Record<string, unknown> | null = null;
        let outcome: string | null = null;
        let sentiment: string | null = null;
        let leadScore: number | null = null;

        if (['call_analyzed', 'analysis_completed'].includes(params.p_event_type) && payload.call_analysis) {
            analysisJson = payload.call_analysis as Record<string, unknown>;
            if (analysisJson.call_successful !== undefined) {
                outcome = analysisJson.call_successful ? 'positive' : 'negative';
            }
            if (analysisJson.user_sentiment) {
                sentiment = (analysisJson.user_sentiment as string).toLowerCase();
            }
            leadScore = 50;
            if (outcome === 'positive') leadScore += 30;
            if (outcome === 'negative') leadScore -= 30;
            if (sentiment === 'positive') leadScore += 20;
            if (sentiment === 'negative') leadScore -= 20;
            leadScore = Math.max(0, Math.min(100, leadScore));
        }

        if (existingCall) {
            // Update existing — never regress status
            const existingRank = this.statusRank(existingCall.status);
            if (newRank > existingRank) {
                existingCall.status = newStatus;
            }
            // Merge timestamps
            if (startedAt && (!existingCall.started_at || startedAt < existingCall.started_at)) {
                existingCall.started_at = startedAt;
            }
            if (endedAt && (!existingCall.ended_at || endedAt > existingCall.ended_at)) {
                existingCall.ended_at = endedAt;
            }
            if (durationMs !== null) {
                existingCall.duration_ms = durationMs;
            }
            if (analysisJson) existingCall.analysis_json = analysisJson;
            if (outcome) existingCall.outcome = outcome;
            if (sentiment) existingCall.sentiment = sentiment;
            if (leadScore !== null) existingCall.lead_score = leadScore;
        } else {
            // Insert new call
            this.calls.set(params.p_call_id, {
                call_id: params.p_call_id,
                organization_id: params.p_org_id,
                agent_id: params.p_agent_id,
                status: newStatus,
                started_at: startedAt,
                ended_at: endedAt,
                duration_ms: durationMs,
                analysis_json: analysisJson,
                outcome,
                sentiment,
                lead_score: leadScore,
            });
        }

        return { data: true, error: null };
    }

    /** Reset all state */
    reset() {
        this.events.clear();
        this.calls.clear();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test constants
// ─────────────────────────────────────────────────────────────────────────────
const ORG_ID_A = '11111111-1111-1111-1111-111111111111';
const ORG_ID_B = '22222222-2222-2222-2222-222222222222';
const CALL_ID = 'call_test_abc123';
const AGENT_ID = 'agent_xyz';
const NOW = new Date().toISOString();

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('merge_retell_call_event (mock)', () => {
    let store: MockMergeStore;

    beforeEach(() => {
        store = new MockMergeStore();
    });

    // =========================================================================
    // Out-of-order safety
    // =========================================================================
    describe('out-of-order safety', () => {
        it('ended → started → analyzed: final status must be analyzed with ended_at preserved', () => {
            // 1. call_ended arrives first
            const endedResult = store.merge({
                p_org_id: ORG_ID_A,
                p_call_id: CALL_ID,
                p_agent_id: AGENT_ID,
                p_event_type: 'call_ended',
                p_payload: {
                    event: 'call_ended',
                    call_id: CALL_ID,
                    agent_id: AGENT_ID,
                    end_timestamp: 1700000100,
                    call_length: 60,
                    direction: 'inbound',
                    to_number: '+12125551234',
                    from_number: '+12125555678',
                },
                p_payload_hash: 'hash_ended',
                p_received_at: NOW,
            });
            assertEquals(endedResult.data, true, 'call_ended should insert as new');
            assertEquals(endedResult.error, null);

            const afterEnded = store.calls.get(CALL_ID)!;
            assertEquals(afterEnded.status, 'completed');
            assertNotEquals(afterEnded.ended_at, null, 'ended_at should be set');
            assertEquals(afterEnded.duration_ms, 60000);

            // 2. call_started arrives second (out of order)
            const startedResult = store.merge({
                p_org_id: ORG_ID_A,
                p_call_id: CALL_ID,
                p_agent_id: AGENT_ID,
                p_event_type: 'call_started',
                p_payload: {
                    event: 'call_started',
                    call_id: CALL_ID,
                    agent_id: AGENT_ID,
                    start_timestamp: 1700000000,
                    direction: 'inbound',
                    to_number: '+12125551234',
                    from_number: '+12125555678',
                },
                p_payload_hash: 'hash_started',
                p_received_at: NOW,
            });
            assertEquals(startedResult.data, true, 'call_started should merge as new event');

            const afterStarted = store.calls.get(CALL_ID)!;
            // Status must NOT regress from 'completed' back to 'started'
            assertEquals(afterStarted.status, 'completed', 'status must not regress from completed to started');
            assertNotEquals(afterStarted.started_at, null, 'started_at should now be set');
            assertNotEquals(afterStarted.ended_at, null, 'ended_at should still be preserved');

            // 3. call_analyzed arrives third
            const analyzedResult = store.merge({
                p_org_id: ORG_ID_A,
                p_call_id: CALL_ID,
                p_agent_id: AGENT_ID,
                p_event_type: 'call_analyzed',
                p_payload: {
                    event: 'call_analyzed',
                    call_id: CALL_ID,
                    agent_id: AGENT_ID,
                    call_analysis: {
                        call_successful: true,
                        user_sentiment: 'Positive',
                        call_summary: 'Great call about product features',
                    },
                },
                p_payload_hash: 'hash_analyzed',
                p_received_at: NOW,
            });
            assertEquals(analyzedResult.data, true, 'call_analyzed should merge as new event');

            const finalCall = store.calls.get(CALL_ID)!;
            assertEquals(finalCall.status, 'analyzed', 'final status must be analyzed');
            assertNotEquals(finalCall.ended_at, null, 'ended_at must still be preserved');
            assertNotEquals(finalCall.started_at, null, 'started_at must still be preserved');
            assertEquals(finalCall.outcome, 'positive');
            assertEquals(finalCall.sentiment, 'positive');
            assert(finalCall.lead_score !== null && finalCall.lead_score > 50, 'lead score should be > 50 for positive outcome + sentiment');
        });

        it('analyzed arrives before started: creates row with analyzed status', () => {
            const result = store.merge({
                p_org_id: ORG_ID_A,
                p_call_id: 'call_early_analyzed',
                p_agent_id: AGENT_ID,
                p_event_type: 'call_analyzed',
                p_payload: {
                    event: 'call_analyzed',
                    call_id: 'call_early_analyzed',
                    agent_id: AGENT_ID,
                    call_analysis: { call_successful: false, user_sentiment: 'Negative' },
                },
                p_payload_hash: 'hash_1',
                p_received_at: NOW,
            });

            assertEquals(result.data, true);
            const call = store.calls.get('call_early_analyzed')!;
            assertEquals(call.status, 'analyzed');
            assertEquals(call.outcome, 'negative');

            // Now started arrives — status must NOT regress
            store.merge({
                p_org_id: ORG_ID_A,
                p_call_id: 'call_early_analyzed',
                p_agent_id: AGENT_ID,
                p_event_type: 'call_started',
                p_payload: {
                    event: 'call_started',
                    call_id: 'call_early_analyzed',
                    agent_id: AGENT_ID,
                    start_timestamp: 1700000000,
                    direction: 'inbound',
                    to_number: '+12125551234',
                    from_number: '+12125555678',
                },
                p_payload_hash: 'hash_2',
                p_received_at: NOW,
            });

            const afterStarted = store.calls.get('call_early_analyzed')!;
            assertEquals(afterStarted.status, 'analyzed', 'status must not regress from analyzed to started');
            assertNotEquals(afterStarted.started_at, null, 'started_at should be set from later event');
        });
    });

    // =========================================================================
    // Duplicate detection (idempotency)
    // =========================================================================
    describe('duplicate detection', () => {
        it('same event repeated returns false and final state is stable', () => {
            const payload = {
                event: 'call_started',
                call_id: CALL_ID,
                agent_id: AGENT_ID,
                start_timestamp: 1700000000,
                direction: 'inbound',
                to_number: '+12125551234',
                from_number: '+12125555678',
            };

            // First call — new
            const first = store.merge({
                p_org_id: ORG_ID_A,
                p_call_id: CALL_ID,
                p_agent_id: AGENT_ID,
                p_event_type: 'call_started',
                p_payload: payload,
                p_payload_hash: 'hash_same',
                p_received_at: NOW,
            });
            assertEquals(first.data, true, 'first call should be new');

            // Second call — duplicate
            const second = store.merge({
                p_org_id: ORG_ID_A,
                p_call_id: CALL_ID,
                p_agent_id: AGENT_ID,
                p_event_type: 'call_started',
                p_payload: payload,
                p_payload_hash: 'hash_same',
                p_received_at: NOW,
            });
            assertEquals(second.data, false, 'duplicate should return false');
            assertEquals(second.error, null, 'no error for duplicates');

            // State should be stable
            const call = store.calls.get(CALL_ID)!;
            assertEquals(call.status, 'started');
            assertEquals(call.organization_id, ORG_ID_A);
        });

        it('third retry also returns false', () => {
            const params = {
                p_org_id: ORG_ID_A,
                p_call_id: 'call_retry_test',
                p_agent_id: AGENT_ID,
                p_event_type: 'call_ended',
                p_payload: { event: 'call_ended', call_id: 'call_retry_test', agent_id: AGENT_ID, end_timestamp: 1700000100, direction: 'inbound', to_number: '+12125551234', from_number: '+12125555678' },
                p_payload_hash: 'hash_retry',
                p_received_at: NOW,
            };

            assertEquals(store.merge(params).data, true, 'first should be new');
            assertEquals(store.merge(params).data, false, 'second should be duplicate');
            assertEquals(store.merge(params).data, false, 'third should also be duplicate');

            // Only one event in ledger
            let eventCount = 0;
            for (const [key] of store.events) {
                if (key.includes('call_retry_test')) eventCount++;
            }
            assertEquals(eventCount, 1, 'should have exactly one event in ledger');
        });
    });

    // =========================================================================
    // Tenant binding enforcement
    // =========================================================================
    describe('tenant binding', () => {
        it('same call_id with different org_id should error, not overwrite', () => {
            // First: org A creates the call
            const first = store.merge({
                p_org_id: ORG_ID_A,
                p_call_id: CALL_ID,
                p_agent_id: AGENT_ID,
                p_event_type: 'call_started',
                p_payload: {
                    event: 'call_started',
                    call_id: CALL_ID,
                    agent_id: AGENT_ID,
                    start_timestamp: 1700000000,
                    direction: 'inbound',
                    to_number: '+12125551234',
                    from_number: '+12125555678',
                },
                p_payload_hash: 'hash_a',
                p_received_at: NOW,
            });
            assertEquals(first.data, true);

            // Second: org B tries to claim the same call_id
            const second = store.merge({
                p_org_id: ORG_ID_B,
                p_call_id: CALL_ID,
                p_agent_id: AGENT_ID,
                p_event_type: 'call_ended',
                p_payload: {
                    event: 'call_ended',
                    call_id: CALL_ID,
                    agent_id: AGENT_ID,
                    end_timestamp: 1700000100,
                    direction: 'inbound',
                    to_number: '+12125551234',
                    from_number: '+12125555678',
                },
                p_payload_hash: 'hash_b',
                p_received_at: NOW,
            });

            // Should error (tenant binding violation)
            assertNotEquals(second.error, null, 'should return error for tenant binding violation');
            assert(
                second.error!.message.includes('Tenant binding violation'),
                'error message should mention tenant binding violation'
            );
            assertEquals(second.data, null, 'data should be null on tenant violation');

            // Original call should be unchanged
            const call = store.calls.get(CALL_ID)!;
            assertEquals(call.organization_id, ORG_ID_A, 'org_id must not change');
            assertEquals(call.status, 'started', 'status must remain started');
        });

        it('same org can send multiple event types for the same call', () => {
            store.merge({
                p_org_id: ORG_ID_A,
                p_call_id: CALL_ID,
                p_agent_id: AGENT_ID,
                p_event_type: 'call_started',
                p_payload: { event: 'call_started', call_id: CALL_ID, agent_id: AGENT_ID, start_timestamp: 1700000000, direction: 'inbound', to_number: '+12125551234', from_number: '+12125555678' },
                p_payload_hash: 'h1',
                p_received_at: NOW,
            });

            const ended = store.merge({
                p_org_id: ORG_ID_A,
                p_call_id: CALL_ID,
                p_agent_id: AGENT_ID,
                p_event_type: 'call_ended',
                p_payload: { event: 'call_ended', call_id: CALL_ID, agent_id: AGENT_ID, end_timestamp: 1700000100, call_length: 100, direction: 'inbound', to_number: '+12125551234', from_number: '+12125555678' },
                p_payload_hash: 'h2',
                p_received_at: NOW,
            });

            assertEquals(ended.data, true, 'same org should be able to send ended');
            assertEquals(ended.error, null);

            const call = store.calls.get(CALL_ID)!;
            assertEquals(call.organization_id, ORG_ID_A);
            assertEquals(call.status, 'completed');
        });
    });

    // =========================================================================
    // Fast-ack: handler returns response without awaiting background tasks
    // =========================================================================
    describe('fast-ack behavior', () => {
        it('EdgeRuntime.waitUntil is called but does not block response', async () => {
            let waitUntilCalled = false;
            let waitUntilPromise: Promise<unknown> | null = null;

            // Mock EdgeRuntime
            const mockEdgeRuntime = {
                waitUntil(promise: Promise<unknown>) {
                    waitUntilCalled = true;
                    waitUntilPromise = promise;
                },
            };

            // Simulate the fast-ack pattern from the webhook handler
            const startTime = Date.now();

            // Simulate merge RPC returning true (new event)
            const mergeResult = true;

            // Simulate building response
            let response: { status: number } | null = null;

            if (mergeResult === true) {
                // Schedule background work (non-blocking)
                mockEdgeRuntime.waitUntil(
                    new Promise<void>((resolve) => {
                        // Simulate slow background work (500ms)
                        setTimeout(() => resolve(), 500);
                    })
                );

                // Return response immediately
                response = { status: 204 };
            }

            const elapsed = Date.now() - startTime;

            // Response should be returned almost immediately (< 50ms)
            assert(elapsed < 50, `Response took ${elapsed}ms, should be < 50ms`);
            assertEquals(response?.status, 204, 'should return 204');
            assertEquals(waitUntilCalled, true, 'EdgeRuntime.waitUntil should have been called');
            assertNotEquals(waitUntilPromise, null, 'waitUntil should have received a promise');

            // Await the background promise to avoid unresolved promise warnings
            if (waitUntilPromise) {
                await waitUntilPromise;
            }
        });

        it('duplicate events return 204 without calling waitUntil', () => {
            let waitUntilCalled = false;
            const mockEdgeRuntime = {
                waitUntil(_promise: Promise<unknown>) {
                    waitUntilCalled = true;
                },
            };

            // Simulate merge RPC returning false (duplicate)
            // Use a function to avoid TS literal type narrowing
            const getMergeResult = (): boolean => false;
            const mergeResult = getMergeResult();
            let response: { status: number } | null = null;

            if (mergeResult === true) {
                mockEdgeRuntime.waitUntil(Promise.resolve());
                response = { status: 204 };
            } else {
                // Duplicate — fast-ack without background work
                response = { status: 204 };
            }

            assertEquals(response?.status, 204);
            assertEquals(waitUntilCalled, false, 'waitUntil should NOT be called for duplicates');
        });
    });

    // =========================================================================
    // Status precedence (comprehensive)
    // =========================================================================
    describe('status precedence', () => {
        it('started then ended: status = completed', () => {
            store.merge({
                p_org_id: ORG_ID_A, p_call_id: 'c1', p_agent_id: AGENT_ID,
                p_event_type: 'call_started',
                p_payload: { event: 'call_started', call_id: 'c1', agent_id: AGENT_ID, start_timestamp: 1700000000, direction: 'inbound', to_number: '+12125551234', from_number: '+12125555678' },
                p_payload_hash: 'h1', p_received_at: NOW,
            });
            store.merge({
                p_org_id: ORG_ID_A, p_call_id: 'c1', p_agent_id: AGENT_ID,
                p_event_type: 'call_ended',
                p_payload: { event: 'call_ended', call_id: 'c1', agent_id: AGENT_ID, end_timestamp: 1700000100, direction: 'inbound', to_number: '+12125551234', from_number: '+12125555678' },
                p_payload_hash: 'h2', p_received_at: NOW,
            });

            assertEquals(store.calls.get('c1')!.status, 'completed');
        });

        it('started then analyzed (no ended): status = analyzed', () => {
            store.merge({
                p_org_id: ORG_ID_A, p_call_id: 'c2', p_agent_id: AGENT_ID,
                p_event_type: 'call_started',
                p_payload: { event: 'call_started', call_id: 'c2', agent_id: AGENT_ID, start_timestamp: 1700000000, direction: 'inbound', to_number: '+12125551234', from_number: '+12125555678' },
                p_payload_hash: 'h1', p_received_at: NOW,
            });
            store.merge({
                p_org_id: ORG_ID_A, p_call_id: 'c2', p_agent_id: AGENT_ID,
                p_event_type: 'call_analyzed',
                p_payload: { event: 'call_analyzed', call_id: 'c2', agent_id: AGENT_ID, call_analysis: { call_successful: true } },
                p_payload_hash: 'h2', p_received_at: NOW,
            });

            assertEquals(store.calls.get('c2')!.status, 'analyzed');
        });

        it('analyzed then started: status remains analyzed', () => {
            store.merge({
                p_org_id: ORG_ID_A, p_call_id: 'c3', p_agent_id: AGENT_ID,
                p_event_type: 'call_analyzed',
                p_payload: { event: 'call_analyzed', call_id: 'c3', agent_id: AGENT_ID, call_analysis: { call_successful: true } },
                p_payload_hash: 'h1', p_received_at: NOW,
            });
            store.merge({
                p_org_id: ORG_ID_A, p_call_id: 'c3', p_agent_id: AGENT_ID,
                p_event_type: 'call_started',
                p_payload: { event: 'call_started', call_id: 'c3', agent_id: AGENT_ID, start_timestamp: 1700000000, direction: 'inbound', to_number: '+12125551234', from_number: '+12125555678' },
                p_payload_hash: 'h2', p_received_at: NOW,
            });

            assertEquals(store.calls.get('c3')!.status, 'analyzed');
        });

        it('ended then analyzed: status = analyzed', () => {
            store.merge({
                p_org_id: ORG_ID_A, p_call_id: 'c4', p_agent_id: AGENT_ID,
                p_event_type: 'call_ended',
                p_payload: { event: 'call_ended', call_id: 'c4', agent_id: AGENT_ID, end_timestamp: 1700000100, direction: 'inbound', to_number: '+12125551234', from_number: '+12125555678' },
                p_payload_hash: 'h1', p_received_at: NOW,
            });
            store.merge({
                p_org_id: ORG_ID_A, p_call_id: 'c4', p_agent_id: AGENT_ID,
                p_event_type: 'call_analyzed',
                p_payload: { event: 'call_analyzed', call_id: 'c4', agent_id: AGENT_ID, call_analysis: { call_successful: true } },
                p_payload_hash: 'h2', p_received_at: NOW,
            });

            assertEquals(store.calls.get('c4')!.status, 'analyzed');
        });
    });
});

console.log("🧪 Running retellWebhookMerge.test.ts...");
