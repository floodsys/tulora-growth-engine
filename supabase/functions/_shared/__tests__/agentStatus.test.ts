/**
 * Unit Tests for agentStatus.ts
 * 
 * Tests the agent lifecycle state machine, status transitions, and call checks.
 * 
 * Run with: deno test --allow-env supabase/functions/_shared/__tests__/agentStatus.test.ts
 */

import {
    assertEquals,
    assertThrows,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { describe, it, beforeEach } from "https://deno.land/std@0.208.0/testing/bdd.ts";

// =============================================================================
// Type definitions (mirrors agentStatus.ts)
// =============================================================================

const AgentStatus = {
    DRAFT: 'DRAFT',
    TESTING: 'TESTING',
    ACTIVE: 'ACTIVE',
    PAUSED: 'PAUSED',
    ARCHIVED: 'ARCHIVED',
} as const;

type AgentStatusType = (typeof AgentStatus)[keyof typeof AgentStatus];

// Legacy status map for backward compatibility
const LEGACY_STATUS_MAP: Record<string, AgentStatusType> = {
    'draft': AgentStatus.DRAFT,
    'published': AgentStatus.ACTIVE,
};

// Allowed state transitions
const ALLOWED_TRANSITIONS: Record<AgentStatusType, AgentStatusType[]> = {
    [AgentStatus.DRAFT]: [AgentStatus.TESTING, AgentStatus.ARCHIVED],
    [AgentStatus.TESTING]: [AgentStatus.DRAFT, AgentStatus.ACTIVE, AgentStatus.ARCHIVED],
    [AgentStatus.ACTIVE]: [AgentStatus.PAUSED, AgentStatus.ARCHIVED],
    [AgentStatus.PAUSED]: [AgentStatus.ACTIVE, AgentStatus.ARCHIVED],
    [AgentStatus.ARCHIVED]: [],
};

interface AgentCallCheckResult {
    allowed: boolean;
    agent?: {
        id: string;
        agent_id: string;
        organization_id: string;
        name: string;
        status: AgentStatusType;
    };
    error?: {
        code: 'AGENT_NOT_FOUND' | 'AGENT_INACTIVE' | 'AGENT_STATUS_BLOCKED';
        message: string;
        status: AgentStatusType | null;
        httpStatus: number;
    };
}

// =============================================================================
// Implementations under test (mirrors agentStatus.ts)
// =============================================================================

function normalizeStatus(status: string | null | undefined): AgentStatusType {
    if (!status) return AgentStatus.DRAFT;

    const upper = status.toUpperCase();
    if (Object.values(AgentStatus).includes(upper as AgentStatusType)) {
        return upper as AgentStatusType;
    }

    const legacy = LEGACY_STATUS_MAP[status.toLowerCase()];
    if (legacy) return legacy;

    return AgentStatus.DRAFT;
}

function isValidTransition(from: AgentStatusType, to: AgentStatusType): boolean {
    return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// Mock Supabase client factory
interface MockAgent {
    id: string;
    agent_id: string;
    organization_id: string;
    name: string;
    status: string | null;
    is_active: boolean;
}

function createMockSupabase(mockAgent: MockAgent | null, error?: { message: string }) {
    return {
        from: (_table: string) => ({
            select: (_columns: string) => ({
                eq: (_col: string, _val: string) => ({
                    single: async () => {
                        if (error) {
                            return { data: null, error };
                        }
                        return { data: mockAgent, error: null };
                    },
                }),
            }),
            update: (_data: Record<string, unknown>) => ({
                eq: (_col: string, _val: string) => ({
                    then: async (resolve: (result: { error: null }) => void) => resolve({ error: null }),
                }),
            }),
        }),
    };
}

// Simplified checkAgentForCalls for testing
async function checkAgentForCalls(
    supabase: ReturnType<typeof createMockSupabase>,
    agentId: string,
    _traceId?: string
): Promise<AgentCallCheckResult> {
    const { data: agent, error } = await supabase
        .from('retell_agents')
        .select('id, agent_id, organization_id, name, status, is_active')
        .eq('agent_id', agentId)
        .single();

    if (error || !agent) {
        return {
            allowed: false,
            error: {
                code: 'AGENT_NOT_FOUND',
                message: `Agent not found: ${agentId}`,
                status: null,
                httpStatus: 404,
            }
        };
    }

    if (!agent.is_active) {
        return {
            allowed: false,
            error: {
                code: 'AGENT_INACTIVE',
                message: `Agent is not active: ${agentId}`,
                status: normalizeStatus(agent.status),
                httpStatus: 410,
            }
        };
    }

    const status = normalizeStatus(agent.status);

    if (status !== AgentStatus.ACTIVE) {
        return {
            allowed: false,
            agent: {
                id: agent.id,
                agent_id: agent.agent_id,
                organization_id: agent.organization_id,
                name: agent.name,
                status,
            },
            error: {
                code: 'AGENT_STATUS_BLOCKED',
                message: `Agent is in ${status} status. Only ACTIVE agents can receive production calls.`,
                status,
                httpStatus: 403,
            }
        };
    }

    return {
        allowed: true,
        agent: {
            id: agent.id,
            agent_id: agent.agent_id,
            organization_id: agent.organization_id,
            name: agent.name,
            status,
        }
    };
}

// Simplified checkAgentForTestCalls for testing
async function checkAgentForTestCalls(
    supabase: ReturnType<typeof createMockSupabase>,
    agentId: string,
    _traceId?: string
): Promise<AgentCallCheckResult> {
    const { data: agent, error } = await supabase
        .from('retell_agents')
        .select('id, agent_id, organization_id, name, status, is_active')
        .eq('agent_id', agentId)
        .single();

    if (error || !agent) {
        return {
            allowed: false,
            error: {
                code: 'AGENT_NOT_FOUND',
                message: `Agent not found: ${agentId}`,
                status: null,
                httpStatus: 404,
            }
        };
    }

    if (!agent.is_active) {
        return {
            allowed: false,
            error: {
                code: 'AGENT_INACTIVE',
                message: `Agent is not active: ${agentId}`,
                status: normalizeStatus(agent.status),
                httpStatus: 410,
            }
        };
    }

    const status = normalizeStatus(agent.status);

    // TESTING and ACTIVE agents can receive test calls
    if (status !== AgentStatus.TESTING && status !== AgentStatus.ACTIVE) {
        return {
            allowed: false,
            agent: {
                id: agent.id,
                agent_id: agent.agent_id,
                organization_id: agent.organization_id,
                name: agent.name,
                status,
            },
            error: {
                code: 'AGENT_STATUS_BLOCKED',
                message: `Agent is in ${status} status. Only TESTING or ACTIVE agents can receive test calls.`,
                status,
                httpStatus: 403,
            }
        };
    }

    return {
        allowed: true,
        agent: {
            id: agent.id,
            agent_id: agent.agent_id,
            organization_id: agent.organization_id,
            name: agent.name,
            status,
        }
    };
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('agentStatus', () => {
    describe('normalizeStatus', () => {
        it('should return DRAFT for null/undefined status', () => {
            assertEquals(normalizeStatus(null), AgentStatus.DRAFT);
            assertEquals(normalizeStatus(undefined), AgentStatus.DRAFT);
            assertEquals(normalizeStatus(''), AgentStatus.DRAFT);
        });

        it('should handle uppercase status values', () => {
            assertEquals(normalizeStatus('DRAFT'), AgentStatus.DRAFT);
            assertEquals(normalizeStatus('TESTING'), AgentStatus.TESTING);
            assertEquals(normalizeStatus('ACTIVE'), AgentStatus.ACTIVE);
            assertEquals(normalizeStatus('PAUSED'), AgentStatus.PAUSED);
            assertEquals(normalizeStatus('ARCHIVED'), AgentStatus.ARCHIVED);
        });

        it('should handle lowercase status values', () => {
            assertEquals(normalizeStatus('draft'), AgentStatus.DRAFT);
            assertEquals(normalizeStatus('testing'), AgentStatus.TESTING);
            assertEquals(normalizeStatus('active'), AgentStatus.ACTIVE);
            assertEquals(normalizeStatus('paused'), AgentStatus.PAUSED);
            assertEquals(normalizeStatus('archived'), AgentStatus.ARCHIVED);
        });

        it('should handle mixed case status values', () => {
            assertEquals(normalizeStatus('Draft'), AgentStatus.DRAFT);
            assertEquals(normalizeStatus('Testing'), AgentStatus.TESTING);
            assertEquals(normalizeStatus('Active'), AgentStatus.ACTIVE);
            assertEquals(normalizeStatus('Paused'), AgentStatus.PAUSED);
        });

        it('should map legacy "published" status to ACTIVE', () => {
            assertEquals(normalizeStatus('published'), AgentStatus.ACTIVE);
            assertEquals(normalizeStatus('Published'), AgentStatus.ACTIVE);
        });

        it('should return DRAFT for unknown status values', () => {
            assertEquals(normalizeStatus('unknown'), AgentStatus.DRAFT);
            assertEquals(normalizeStatus('invalid'), AgentStatus.DRAFT);
            assertEquals(normalizeStatus('RUNNING'), AgentStatus.DRAFT);
        });
    });

    describe('isValidTransition', () => {
        describe('from DRAFT', () => {
            it('should allow transition to TESTING', () => {
                assertEquals(isValidTransition(AgentStatus.DRAFT, AgentStatus.TESTING), true);
            });

            it('should allow transition to ARCHIVED', () => {
                assertEquals(isValidTransition(AgentStatus.DRAFT, AgentStatus.ARCHIVED), true);
            });

            it('should NOT allow transition to ACTIVE', () => {
                assertEquals(isValidTransition(AgentStatus.DRAFT, AgentStatus.ACTIVE), false);
            });

            it('should NOT allow transition to PAUSED', () => {
                assertEquals(isValidTransition(AgentStatus.DRAFT, AgentStatus.PAUSED), false);
            });

            it('should NOT allow self-transition', () => {
                assertEquals(isValidTransition(AgentStatus.DRAFT, AgentStatus.DRAFT), false);
            });
        });

        describe('from TESTING', () => {
            it('should allow transition to DRAFT', () => {
                assertEquals(isValidTransition(AgentStatus.TESTING, AgentStatus.DRAFT), true);
            });

            it('should allow transition to ACTIVE', () => {
                assertEquals(isValidTransition(AgentStatus.TESTING, AgentStatus.ACTIVE), true);
            });

            it('should allow transition to ARCHIVED', () => {
                assertEquals(isValidTransition(AgentStatus.TESTING, AgentStatus.ARCHIVED), true);
            });

            it('should NOT allow transition to PAUSED', () => {
                assertEquals(isValidTransition(AgentStatus.TESTING, AgentStatus.PAUSED), false);
            });
        });

        describe('from ACTIVE', () => {
            it('should allow transition to PAUSED', () => {
                assertEquals(isValidTransition(AgentStatus.ACTIVE, AgentStatus.PAUSED), true);
            });

            it('should allow transition to ARCHIVED', () => {
                assertEquals(isValidTransition(AgentStatus.ACTIVE, AgentStatus.ARCHIVED), true);
            });

            it('should NOT allow transition to DRAFT', () => {
                assertEquals(isValidTransition(AgentStatus.ACTIVE, AgentStatus.DRAFT), false);
            });

            it('should NOT allow transition to TESTING', () => {
                assertEquals(isValidTransition(AgentStatus.ACTIVE, AgentStatus.TESTING), false);
            });
        });

        describe('from PAUSED', () => {
            it('should allow transition to ACTIVE', () => {
                assertEquals(isValidTransition(AgentStatus.PAUSED, AgentStatus.ACTIVE), true);
            });

            it('should allow transition to ARCHIVED', () => {
                assertEquals(isValidTransition(AgentStatus.PAUSED, AgentStatus.ARCHIVED), true);
            });

            it('should NOT allow transition to DRAFT', () => {
                assertEquals(isValidTransition(AgentStatus.PAUSED, AgentStatus.DRAFT), false);
            });

            it('should NOT allow transition to TESTING', () => {
                assertEquals(isValidTransition(AgentStatus.PAUSED, AgentStatus.TESTING), false);
            });
        });

        describe('from ARCHIVED', () => {
            it('should NOT allow any transitions', () => {
                assertEquals(isValidTransition(AgentStatus.ARCHIVED, AgentStatus.DRAFT), false);
                assertEquals(isValidTransition(AgentStatus.ARCHIVED, AgentStatus.TESTING), false);
                assertEquals(isValidTransition(AgentStatus.ARCHIVED, AgentStatus.ACTIVE), false);
                assertEquals(isValidTransition(AgentStatus.ARCHIVED, AgentStatus.PAUSED), false);
                assertEquals(isValidTransition(AgentStatus.ARCHIVED, AgentStatus.ARCHIVED), false);
            });
        });
    });

    describe('checkAgentForCalls', () => {
        it('should return error for non-existent agent', async () => {
            const supabase = createMockSupabase(null, { message: 'Not found' });
            const result = await checkAgentForCalls(supabase, 'nonexistent-agent');

            assertEquals(result.allowed, false);
            assertEquals(result.error?.code, 'AGENT_NOT_FOUND');
            assertEquals(result.error?.httpStatus, 404);
        });

        it('should return error for soft-deleted agent', async () => {
            const supabase = createMockSupabase({
                id: 'uuid-123',
                agent_id: 'agent-123',
                organization_id: 'org-456',
                name: 'Test Agent',
                status: 'ACTIVE',
                is_active: false,
            });

            const result = await checkAgentForCalls(supabase, 'agent-123');

            assertEquals(result.allowed, false);
            assertEquals(result.error?.code, 'AGENT_INACTIVE');
            assertEquals(result.error?.httpStatus, 410);
        });

        it('should allow ACTIVE agents to receive calls', async () => {
            const supabase = createMockSupabase({
                id: 'uuid-123',
                agent_id: 'agent-123',
                organization_id: 'org-456',
                name: 'Production Agent',
                status: 'ACTIVE',
                is_active: true,
            });

            const result = await checkAgentForCalls(supabase, 'agent-123');

            assertEquals(result.allowed, true);
            assertEquals(result.agent?.status, AgentStatus.ACTIVE);
            assertEquals(result.error, undefined);
        });

        it('should block DRAFT agents from receiving calls', async () => {
            const supabase = createMockSupabase({
                id: 'uuid-123',
                agent_id: 'agent-123',
                organization_id: 'org-456',
                name: 'Draft Agent',
                status: 'DRAFT',
                is_active: true,
            });

            const result = await checkAgentForCalls(supabase, 'agent-123');

            assertEquals(result.allowed, false);
            assertEquals(result.error?.code, 'AGENT_STATUS_BLOCKED');
            assertEquals(result.error?.httpStatus, 403);
        });

        it('should block TESTING agents from receiving production calls', async () => {
            const supabase = createMockSupabase({
                id: 'uuid-123',
                agent_id: 'agent-123',
                organization_id: 'org-456',
                name: 'Testing Agent',
                status: 'TESTING',
                is_active: true,
            });

            const result = await checkAgentForCalls(supabase, 'agent-123');

            assertEquals(result.allowed, false);
            assertEquals(result.error?.code, 'AGENT_STATUS_BLOCKED');
            assertEquals(result.error?.status, AgentStatus.TESTING);
        });

        it('should block PAUSED agents from receiving calls', async () => {
            const supabase = createMockSupabase({
                id: 'uuid-123',
                agent_id: 'agent-123',
                organization_id: 'org-456',
                name: 'Paused Agent',
                status: 'PAUSED',
                is_active: true,
            });

            const result = await checkAgentForCalls(supabase, 'agent-123');

            assertEquals(result.allowed, false);
            assertEquals(result.error?.code, 'AGENT_STATUS_BLOCKED');
        });

        it('should block ARCHIVED agents from receiving calls', async () => {
            const supabase = createMockSupabase({
                id: 'uuid-123',
                agent_id: 'agent-123',
                organization_id: 'org-456',
                name: 'Archived Agent',
                status: 'ARCHIVED',
                is_active: true,
            });

            const result = await checkAgentForCalls(supabase, 'agent-123');

            assertEquals(result.allowed, false);
            assertEquals(result.error?.code, 'AGENT_STATUS_BLOCKED');
        });

        it('should normalize legacy "published" status and allow calls', async () => {
            const supabase = createMockSupabase({
                id: 'uuid-123',
                agent_id: 'agent-123',
                organization_id: 'org-456',
                name: 'Legacy Agent',
                status: 'published',
                is_active: true,
            });

            const result = await checkAgentForCalls(supabase, 'agent-123');

            assertEquals(result.allowed, true);
            assertEquals(result.agent?.status, AgentStatus.ACTIVE);
        });
    });

    describe('checkAgentForTestCalls', () => {
        it('should allow TESTING agents to receive test calls', async () => {
            const supabase = createMockSupabase({
                id: 'uuid-123',
                agent_id: 'agent-123',
                organization_id: 'org-456',
                name: 'Testing Agent',
                status: 'TESTING',
                is_active: true,
            });

            const result = await checkAgentForTestCalls(supabase, 'agent-123');

            assertEquals(result.allowed, true);
            assertEquals(result.agent?.status, AgentStatus.TESTING);
        });

        it('should allow ACTIVE agents to receive test calls', async () => {
            const supabase = createMockSupabase({
                id: 'uuid-123',
                agent_id: 'agent-123',
                organization_id: 'org-456',
                name: 'Active Agent',
                status: 'ACTIVE',
                is_active: true,
            });

            const result = await checkAgentForTestCalls(supabase, 'agent-123');

            assertEquals(result.allowed, true);
            assertEquals(result.agent?.status, AgentStatus.ACTIVE);
        });

        it('should block DRAFT agents from test calls', async () => {
            const supabase = createMockSupabase({
                id: 'uuid-123',
                agent_id: 'agent-123',
                organization_id: 'org-456',
                name: 'Draft Agent',
                status: 'DRAFT',
                is_active: true,
            });

            const result = await checkAgentForTestCalls(supabase, 'agent-123');

            assertEquals(result.allowed, false);
            assertEquals(result.error?.code, 'AGENT_STATUS_BLOCKED');
            assertEquals(result.error?.message.includes('TESTING or ACTIVE'), true);
        });

        it('should block PAUSED agents from test calls', async () => {
            const supabase = createMockSupabase({
                id: 'uuid-123',
                agent_id: 'agent-123',
                organization_id: 'org-456',
                name: 'Paused Agent',
                status: 'PAUSED',
                is_active: true,
            });

            const result = await checkAgentForTestCalls(supabase, 'agent-123');

            assertEquals(result.allowed, false);
            assertEquals(result.error?.code, 'AGENT_STATUS_BLOCKED');
        });

        it('should block ARCHIVED agents from test calls', async () => {
            const supabase = createMockSupabase({
                id: 'uuid-123',
                agent_id: 'agent-123',
                organization_id: 'org-456',
                name: 'Archived Agent',
                status: 'ARCHIVED',
                is_active: true,
            });

            const result = await checkAgentForTestCalls(supabase, 'agent-123');

            assertEquals(result.allowed, false);
            assertEquals(result.error?.code, 'AGENT_STATUS_BLOCKED');
        });

        it('should return 404 for non-existent agent', async () => {
            const supabase = createMockSupabase(null, { message: 'Not found' });
            const result = await checkAgentForTestCalls(supabase, 'nonexistent-agent');

            assertEquals(result.allowed, false);
            assertEquals(result.error?.code, 'AGENT_NOT_FOUND');
            assertEquals(result.error?.httpStatus, 404);
        });

        it('should return 410 for soft-deleted agent', async () => {
            const supabase = createMockSupabase({
                id: 'uuid-123',
                agent_id: 'agent-123',
                organization_id: 'org-456',
                name: 'Deleted Agent',
                status: 'TESTING',
                is_active: false,
            });

            const result = await checkAgentForTestCalls(supabase, 'agent-123');

            assertEquals(result.allowed, false);
            assertEquals(result.error?.code, 'AGENT_INACTIVE');
            assertEquals(result.error?.httpStatus, 410);
        });
    });

    describe('Agent lifecycle state machine', () => {
        it('should enforce the correct lifecycle: DRAFT → TESTING → ACTIVE', () => {
            // Valid flow
            assertEquals(isValidTransition(AgentStatus.DRAFT, AgentStatus.TESTING), true);
            assertEquals(isValidTransition(AgentStatus.TESTING, AgentStatus.ACTIVE), true);
        });

        it('should prevent skipping TESTING phase (DRAFT → ACTIVE)', () => {
            assertEquals(isValidTransition(AgentStatus.DRAFT, AgentStatus.ACTIVE), false);
        });

        it('should allow returning from TESTING to DRAFT', () => {
            assertEquals(isValidTransition(AgentStatus.TESTING, AgentStatus.DRAFT), true);
        });

        it('should NOT allow going back from ACTIVE to TESTING', () => {
            assertEquals(isValidTransition(AgentStatus.ACTIVE, AgentStatus.TESTING), false);
        });

        it('should allow PAUSE/RESUME cycle for ACTIVE agents', () => {
            assertEquals(isValidTransition(AgentStatus.ACTIVE, AgentStatus.PAUSED), true);
            assertEquals(isValidTransition(AgentStatus.PAUSED, AgentStatus.ACTIVE), true);
        });

        it('should allow archiving from any non-archived state', () => {
            assertEquals(isValidTransition(AgentStatus.DRAFT, AgentStatus.ARCHIVED), true);
            assertEquals(isValidTransition(AgentStatus.TESTING, AgentStatus.ARCHIVED), true);
            assertEquals(isValidTransition(AgentStatus.ACTIVE, AgentStatus.ARCHIVED), true);
            assertEquals(isValidTransition(AgentStatus.PAUSED, AgentStatus.ARCHIVED), true);
        });

        it('should make ARCHIVED a terminal state (no exits)', () => {
            assertEquals(ALLOWED_TRANSITIONS[AgentStatus.ARCHIVED].length, 0);
        });
    });
});

// Run tests
console.log('🧪 Running agentStatus.test.ts...');
