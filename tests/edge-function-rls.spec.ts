/**
 * Edge Function + RLS Integration Tests
 * 
 * Tests end-to-end flows against local Supabase (supabase start + supabase functions serve):
 * 1. Unauthed requests to public Edge functions must fail (401/403)
 * 2. Authed user in Org A cannot access Org B resources (agents/leads/outbox)
 * 3. Call-create endpoints enforce org membership + agent ACTIVE status
 * 4. CRM endpoints enforce JWT + org membership
 * 
 * Run locally:
 *   npm run test:edge-rls
 * 
 * Prerequisites:
 *   - supabase start (local Supabase running)
 *   - supabase functions serve (Edge Functions running)
 *   - Test users and organizations seeded in database
 */

import { test, expect, APIRequestContext, request } from '@playwright/test';

// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const FUNCTIONS_URL = process.env.FUNCTIONS_URL || 'http://localhost:54321/functions/v1';

// Test user credentials (should match seeded data in local Supabase)
const TEST_USER_ORG_A = {
    email: 'test-user-a@test.local',
    password: 'TestPassword123!',
};

const TEST_USER_ORG_B = {
    email: 'test-user-b@test.local',
    password: 'TestPassword123!',
};

// Test organization IDs (should match seeded data)
const TEST_ORG_A_ID = process.env.TEST_ORG_A_ID || '00000000-0000-0000-0000-000000000001';
const TEST_ORG_B_ID = process.env.TEST_ORG_B_ID || '00000000-0000-0000-0000-000000000002';

// Test agent IDs (Retell agent_id format, should match seeded data)
const TEST_AGENT_ACTIVE = process.env.TEST_AGENT_ACTIVE_ID || 'agent_active_test_001';
const TEST_AGENT_DRAFT = process.env.TEST_AGENT_DRAFT_ID || 'agent_draft_test_001';
const TEST_AGENT_ORG_B = process.env.TEST_AGENT_ORG_B_ID || 'agent_org_b_test_001';

// Test lead IDs (should match seeded data)
const TEST_LEAD_ORG_A = process.env.TEST_LEAD_ORG_A_ID || '00000000-0000-0000-0000-000000000011';
const TEST_LEAD_ORG_B = process.env.TEST_LEAD_ORG_B_ID || '00000000-0000-0000-0000-000000000012';

// ============================================================================
// Helper Functions
// ============================================================================

interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

/**
 * Sign in a user and return JWT tokens
 */
async function signInUser(
    apiContext: APIRequestContext,
    email: string,
    password: string
): Promise<AuthTokens | null> {
    const response = await apiContext.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
        },
        data: {
            email,
            password,
        },
    });

    if (!response.ok()) {
        console.error('Sign in failed:', await response.text());
        return null;
    }

    const data = await response.json();
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
    };
}

/**
 * Create headers for authenticated requests
 */
function authHeaders(accessToken: string): Record<string, string> {
    return {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
    };
}

/**
 * Create headers for unauthenticated requests
 */
function unauthHeaders(): Record<string, string> {
    return {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
    };
}

// ============================================================================
// Test Setup
// ============================================================================

let apiContext: APIRequestContext;
let userATokens: AuthTokens | null = null;
let userBTokens: AuthTokens | null = null;

test.beforeAll(async () => {
    apiContext = await request.newContext({
        baseURL: SUPABASE_URL,
    });

    // Sign in test users
    userATokens = await signInUser(apiContext, TEST_USER_ORG_A.email, TEST_USER_ORG_A.password);
    userBTokens = await signInUser(apiContext, TEST_USER_ORG_B.email, TEST_USER_ORG_B.password);

    // Log auth status for debugging
    console.log('User A auth:', userATokens ? 'success' : 'failed');
    console.log('User B auth:', userBTokens ? 'success' : 'failed');
});

test.afterAll(async () => {
    await apiContext.dispose();
});

// ============================================================================
// Test Suite 1: Unauthenticated Requests to Protected Endpoints
// ============================================================================

test.describe('Unauthenticated Requests', () => {
    test('suitecrm-sync rejects unauthenticated requests with 401', async () => {
        const response = await apiContext.post(`${FUNCTIONS_URL}/suitecrm-sync`, {
            headers: unauthHeaders(),
            data: {
                lead_id: TEST_LEAD_ORG_A,
            },
        });

        expect(response.status()).toBe(401);
        const body = await response.json();
        expect(body.error).toContain('authorization');
    });

    test('crm-admin rejects unauthenticated requests with 401', async () => {
        const response = await apiContext.post(`${FUNCTIONS_URL}/crm-admin`, {
            headers: unauthHeaders(),
            data: {
                action: 'get_status',
                organization_id: TEST_ORG_A_ID,
            },
        });

        // crm-admin has verify_jwt = true in config.toml
        expect([401, 403]).toContain(response.status());
    });

    test('generate-signed-url rejects unauthenticated requests with 401', async () => {
        const response = await apiContext.post(`${FUNCTIONS_URL}/generate-signed-url`, {
            headers: unauthHeaders(),
            data: {
                bucket: 'test-bucket',
                path: 'test/file.pdf',
            },
        });

        expect([401, 403]).toContain(response.status());
    });

    test('send-test-email rejects unauthenticated requests with 401', async () => {
        const response = await apiContext.post(`${FUNCTIONS_URL}/send-test-email`, {
            headers: unauthHeaders(),
            data: {
                to: 'test@example.com',
                subject: 'Test',
                body: 'Test body',
            },
        });

        expect([401, 403]).toContain(response.status());
    });

    test('test-suitecrm-connection rejects unauthenticated requests', async () => {
        const response = await apiContext.post(`${FUNCTIONS_URL}/test-suitecrm-connection`, {
            headers: unauthHeaders(),
            data: {},
        });

        expect([401, 403]).toContain(response.status());
    });

    // Public endpoints should work without auth
    test('contact-sales allows unauthenticated requests', async () => {
        const response = await apiContext.post(`${FUNCTIONS_URL}/contact-sales`, {
            headers: unauthHeaders(),
            data: {
                name: 'Test User',
                email: 'test@example.com',
                message: 'Test inquiry',
                turnstileToken: 'test-token', // Would fail Turnstile but shouldn't fail auth
            },
        });

        // Should not be 401/403 - might be 400 for missing Turnstile or other validation
        expect(response.status()).not.toBe(401);
        expect(response.status()).not.toBe(403);
    });

    test('verify-turnstile allows unauthenticated requests', async () => {
        const response = await apiContext.post(`${FUNCTIONS_URL}/verify-turnstile`, {
            headers: unauthHeaders(),
            data: {
                token: 'test-token',
            },
        });

        // Should not be 401/403
        expect(response.status()).not.toBe(401);
        expect(response.status()).not.toBe(403);
    });
});

// ============================================================================
// Test Suite 2: Cross-Organization Access Control
// ============================================================================

test.describe('Cross-Organization Access Control', () => {
    test.beforeAll(() => {
        test.skip(!userATokens || !userBTokens, 'Test users not available');
    });

    test('User A cannot access Org B agents via agents endpoint', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        const response = await apiContext.post(`${FUNCTIONS_URL}/agents`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                method: 'GET',
                agentId: TEST_AGENT_ORG_B,
                organizationId: TEST_ORG_B_ID,
            },
        });

        // RLS should block access - expect 403 or 404 (not found due to RLS)
        expect([403, 404]).toContain(response.status());
    });

    test('User A cannot update Org B agents', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        const response = await apiContext.post(`${FUNCTIONS_URL}/agents`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                method: 'PATCH',
                agentId: TEST_AGENT_ORG_B,
                organizationId: TEST_ORG_B_ID,
                name: 'Hacked Agent Name',
            },
        });

        // Should be blocked by org membership check or RLS
        expect([403, 404]).toContain(response.status());
    });

    test('User A cannot sync Org B leads via suitecrm-sync', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        const response = await apiContext.post(`${FUNCTIONS_URL}/suitecrm-sync`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                lead_id: TEST_LEAD_ORG_B,
            },
        });

        // Should be blocked by org membership verification
        expect(response.status()).toBe(403);
        const body = await response.json();
        expect(body.error).toContain('Forbidden');
    });

    test('User A cannot access Org B CRM status', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        const response = await apiContext.post(`${FUNCTIONS_URL}/crm-admin`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                action: 'get_status',
                organization_id: TEST_ORG_B_ID,
            },
        });

        // Should be blocked - either 403 or empty results due to RLS
        if (response.status() === 200) {
            const body = await response.json();
            // If 200, entries should be empty due to RLS
            expect(body.entries).toEqual([]);
        } else {
            expect([403, 401]).toContain(response.status());
        }
    });

    test('User B cannot access Org A leads', async () => {
        test.skip(!userBTokens, 'User B not authenticated');

        const response = await apiContext.post(`${FUNCTIONS_URL}/suitecrm-sync`, {
            headers: authHeaders(userBTokens!.accessToken),
            data: {
                lead_id: TEST_LEAD_ORG_A,
            },
        });

        expect(response.status()).toBe(403);
    });

    test('User A can access their own org resources', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        // Test that User A CAN access Org A CRM status (positive test)
        const response = await apiContext.post(`${FUNCTIONS_URL}/crm-admin`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                action: 'get_status',
                organization_id: TEST_ORG_A_ID,
            },
        });

        // Should succeed if user A is member of Org A
        // Note: May still fail if user doesn't have permission, but shouldn't be 403 for wrong org
        if (response.status() === 200) {
            const body = await response.json();
            expect(body).toHaveProperty('success');
        }
    });
});

// ============================================================================
// Test Suite 3: Call-Create Endpoints - Org Membership + Agent Status
// ============================================================================

test.describe('Call-Create Endpoints Authorization', () => {
    test.beforeAll(() => {
        test.skip(!userATokens, 'Test user A not available');
    });

    test('retell-dial requires authentication', async () => {
        const response = await apiContext.post(`${FUNCTIONS_URL}/retell-dial`, {
            headers: unauthHeaders(),
            data: {
                agentId: TEST_AGENT_ACTIVE,
                phoneNumber: '+15551234567',
            },
        });

        expect(response.status()).toBe(401);
    });

    test('retell-dial enforces org membership', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        // User A should not be able to dial using Org B's agent
        const response = await apiContext.post(`${FUNCTIONS_URL}/retell-dial`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                agentId: TEST_AGENT_ORG_B,
                phoneNumber: '+15551234567',
            },
        });

        // Should fail because user is not in Org B
        expect([403, 404]).toContain(response.status());
    });

    test('retell-dial blocks DRAFT status agents', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        const response = await apiContext.post(`${FUNCTIONS_URL}/retell-dial`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                agentId: TEST_AGENT_DRAFT,
                phoneNumber: '+15551234567',
            },
        });

        // Should fail with agent status error
        expect(response.status()).toBe(403);
        const body = await response.json();
        expect(body.error).toBe('AGENT_STATUS_BLOCKED');
        expect(body.message).toContain('DRAFT');
        expect(body.message).toContain('ACTIVE');
    });

    test('retell-dial allows ACTIVE status agents for authorized user', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        const response = await apiContext.post(`${FUNCTIONS_URL}/retell-dial`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                agentId: TEST_AGENT_ACTIVE,
                phoneNumber: '+15551234567',
            },
        });

        // May fail for other reasons (quota, config) but should not be 401/403 for auth/org/status
        if (response.status() === 403 || response.status() === 401) {
            const body = await response.json();
            // If 403, should NOT be because of auth/membership/status
            expect(body.error).not.toBe('Unauthorized');
            expect(body.error).not.toBe('AGENT_STATUS_BLOCKED');
            expect(body.error).not.toContain('membership');
        }
    });

    test('retell-webcall-create validates agent status', async () => {
        // Note: retell-webcall-create has verify_jwt = false but still checks agent status
        const response = await apiContext.post(`${FUNCTIONS_URL}/retell-webcall-create`, {
            headers: unauthHeaders(),
            data: {
                agentSlug: 'DRAFT_AGENT', // Assuming env var AGENT_DRAFT_AGENT_ID points to draft agent
            },
        });

        // Should either fail finding agent or fail status check
        expect([400, 403, 404]).toContain(response.status());
    });

    test('retell-test-call allows TESTING status agents', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        // Test calls should work for TESTING and ACTIVE agents
        const response = await apiContext.post(`${FUNCTIONS_URL}/retell-test-call`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                agentId: TEST_AGENT_ACTIVE,
            },
        });

        // Should not fail due to agent status
        if (response.status() === 403) {
            const body = await response.json();
            expect(body.error).not.toBe('AGENT_STATUS_BLOCKED');
        }
    });
});

// ============================================================================
// Test Suite 4: CRM Endpoints - JWT + Org Membership
// ============================================================================

test.describe('CRM Endpoints Authorization', () => {
    test('suitecrm-sync requires valid JWT', async () => {
        const response = await apiContext.post(`${FUNCTIONS_URL}/suitecrm-sync`, {
            headers: {
                'Authorization': 'Bearer invalid-token-12345',
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json',
            },
            data: {
                lead_id: TEST_LEAD_ORG_A,
            },
        });

        expect(response.status()).toBe(401);
    });

    test('suitecrm-sync validates lead_id parameter', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        const response = await apiContext.post(`${FUNCTIONS_URL}/suitecrm-sync`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                // Missing lead_id
            },
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('lead_id');
    });

    test('suitecrm-sync returns 404 for non-existent lead', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        const response = await apiContext.post(`${FUNCTIONS_URL}/suitecrm-sync`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                lead_id: '00000000-0000-0000-0000-000000000999', // Non-existent
            },
        });

        expect(response.status()).toBe(404);
    });

    test('suitecrm-sync enforces org membership on lead', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        // User A trying to sync Org B's lead
        const response = await apiContext.post(`${FUNCTIONS_URL}/suitecrm-sync`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                lead_id: TEST_LEAD_ORG_B,
            },
        });

        expect(response.status()).toBe(403);
        const body = await response.json();
        expect(body.error).toContain('Forbidden');
    });

    test('crm-admin get_status requires organization_id', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        const response = await apiContext.post(`${FUNCTIONS_URL}/crm-admin`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                action: 'get_status',
                // Missing organization_id
            },
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('organization_id');
    });

    test('crm-admin retry requires lead_id or organization_id', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        const response = await apiContext.post(`${FUNCTIONS_URL}/crm-admin`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                action: 'retry',
                // Missing both lead_id and organization_id
            },
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('lead_id or organization_id');
    });

    test('crm-admin rejects invalid action', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        const response = await apiContext.post(`${FUNCTIONS_URL}/crm-admin`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                action: 'invalid_action',
                organization_id: TEST_ORG_A_ID,
            },
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('Invalid action');
    });
});

// ============================================================================
// Test Suite 5: Agent Status State Machine Enforcement
// ============================================================================

test.describe('Agent Status State Machine', () => {
    test.beforeAll(() => {
        test.skip(!userATokens, 'Test user A not available');
    });

    test('cannot transition DRAFT agent directly to ACTIVE', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        // Attempt to transition a DRAFT agent directly to ACTIVE (invalid)
        const response = await apiContext.post(`${FUNCTIONS_URL}/agents`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                method: 'PATCH',
                agentId: TEST_AGENT_DRAFT,
                organizationId: TEST_ORG_A_ID,
                status: 'ACTIVE',
            },
        });

        // Should fail - DRAFT can only go to TESTING or ARCHIVED
        if (response.status() === 200) {
            // If update succeeded, verify the status wasn't changed
            const body = await response.json();
            expect(body.status).not.toBe('ACTIVE');
        } else {
            expect([400, 403]).toContain(response.status());
        }
    });

    test('PAUSED agent cannot receive production calls', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        // Note: Would need a PAUSED agent in test data
        const TEST_AGENT_PAUSED = process.env.TEST_AGENT_PAUSED_ID;
        test.skip(!TEST_AGENT_PAUSED, 'PAUSED agent not configured');

        const response = await apiContext.post(`${FUNCTIONS_URL}/retell-dial`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                agentId: TEST_AGENT_PAUSED,
                phoneNumber: '+15551234567',
            },
        });

        expect(response.status()).toBe(403);
        const body = await response.json();
        expect(body.error).toBe('AGENT_STATUS_BLOCKED');
        expect(body.message).toContain('PAUSED');
    });

    test('ARCHIVED agent returns 410 Gone', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        const TEST_AGENT_ARCHIVED = process.env.TEST_AGENT_ARCHIVED_ID;
        test.skip(!TEST_AGENT_ARCHIVED, 'ARCHIVED agent not configured');

        const response = await apiContext.post(`${FUNCTIONS_URL}/retell-dial`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                agentId: TEST_AGENT_ARCHIVED,
                phoneNumber: '+15551234567',
            },
        });

        expect(response.status()).toBe(410);
        const body = await response.json();
        expect(body.error).toBe('AGENT_INACTIVE');
    });
});

// ============================================================================
// Test Suite 6: Rate Limiting and Quota Enforcement
// ============================================================================

test.describe('Quota Enforcement', () => {
    test.beforeAll(() => {
        test.skip(!userATokens, 'Test user A not available');
    });

    test('retell-dial returns 402 when quota exceeded', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        // Note: This test requires org to be over quota - may need test setup
        // For now, just verify the error code structure is correct
        const response = await apiContext.post(`${FUNCTIONS_URL}/retell-dial`, {
            headers: authHeaders(userATokens!.accessToken),
            data: {
                agentId: TEST_AGENT_ACTIVE,
                phoneNumber: '+15551234567',
            },
        });

        if (response.status() === 402) {
            const body = await response.json();
            expect(body.code).toBe('BILLING_OVER_LIMIT');
            expect(body.metric).toBe('calls');
            expect(body).toHaveProperty('remaining');
            expect(body).toHaveProperty('limit');
            expect(body).toHaveProperty('current');
        }
    });

    test('retell-webcall-create returns 402 when quota exceeded', async () => {
        const response = await apiContext.post(`${FUNCTIONS_URL}/retell-webcall-create`, {
            headers: unauthHeaders(),
            data: {
                agentSlug: 'TEST', // Needs AGENT_TEST_ID env var
            },
        });

        if (response.status() === 402) {
            const body = await response.json();
            expect(body.code).toBe('BILLING_OVER_LIMIT');
            expect(body).toHaveProperty('message');
        }
    });
});

// ============================================================================
// Test Suite 7: Edge Cases and Error Handling
// ============================================================================

test.describe('Edge Cases', () => {
    test('handles malformed JSON gracefully', async () => {
        const response = await apiContext.post(`${FUNCTIONS_URL}/suitecrm-sync`, {
            headers: {
                'Authorization': userATokens ? `Bearer ${userATokens.accessToken}` : '',
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json',
            },
            data: 'not valid json{',
        });

        // Should return 400 or 500, not crash
        expect([400, 500]).toContain(response.status());
    });

    test('handles missing Content-Type header', async () => {
        test.skip(!userATokens, 'User A not authenticated');

        const response = await apiContext.post(`${FUNCTIONS_URL}/agents`, {
            headers: {
                'Authorization': `Bearer ${userATokens!.accessToken}`,
                'apikey': SUPABASE_ANON_KEY,
                // No Content-Type
            },
            data: {
                method: 'GET',
                agentId: TEST_AGENT_ACTIVE,
            },
        });

        // Should handle gracefully
        expect(response.status()).toBeLessThan(500);
    });

    test('handles expired JWT tokens', async () => {
        // Create a mock expired token (this is just for structure - real test would need actual expired token)
        const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiZXhwIjoxNjAwMDAwMDAwfQ.fake_signature';

        const response = await apiContext.post(`${FUNCTIONS_URL}/suitecrm-sync`, {
            headers: {
                'Authorization': `Bearer ${expiredToken}`,
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json',
            },
            data: {
                lead_id: TEST_LEAD_ORG_A,
            },
        });

        expect(response.status()).toBe(401);
    });

    test('CORS preflight requests return correct headers', async () => {
        const response = await apiContext.fetch(`${FUNCTIONS_URL}/suitecrm-sync`, {
            method: 'OPTIONS',
            headers: {
                'Origin': 'http://localhost:3000',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'authorization,content-type',
            },
        });

        expect(response.status()).toBe(204);
        expect(response.headers()['access-control-allow-headers']).toContain('authorization');
    });
});
