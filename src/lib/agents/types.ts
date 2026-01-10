/**
 * Agent Lifecycle State Machine
 * 
 * This module defines the explicit lifecycle states for Retell agents ("AI workers")
 * and enforces valid state transitions across the application.
 * 
 * State Descriptions:
 * - DRAFT: Agent is being configured. Editable. No calls allowed.
 * - TESTING: Agent can receive test calls from internal tools only. Not public.
 * - ACTIVE: Full production mode. Widgets, dial, outbound calls all allowed.
 * - PAUSED: Temporarily disabled. Config preserved, no new calls allowed.
 * - ARCHIVED: Read-only. Cannot be used for new calls or edited. Historical only.
 */

/**
 * The five lifecycle states for a Retell agent.
 */
export const AgentStatus = {
  DRAFT: 'DRAFT',
  TESTING: 'TESTING',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type AgentStatusType = (typeof AgentStatus)[keyof typeof AgentStatus];

/**
 * Legacy status values for backward compatibility.
 * Maps old values to new AgentStatus values.
 */
export const LEGACY_STATUS_MAP: Record<string, AgentStatusType> = {
  'draft': AgentStatus.DRAFT,
  'published': AgentStatus.ACTIVE, // Previously "published" is now "ACTIVE"
};

/**
 * Normalize a status value to the new AgentStatus format.
 * Handles legacy values and case-insensitive input.
 */
export function normalizeAgentStatus(status: string | null | undefined): AgentStatusType {
  if (!status) return AgentStatus.DRAFT;
  
  const upper = status.toUpperCase();
  
  // Check if it's already a valid new status
  if (Object.values(AgentStatus).includes(upper as AgentStatusType)) {
    return upper as AgentStatusType;
  }
  
  // Check legacy mapping
  const legacy = LEGACY_STATUS_MAP[status.toLowerCase()];
  if (legacy) return legacy;
  
  // Default to DRAFT for unknown values
  return AgentStatus.DRAFT;
}

/**
 * Allowed state transitions for agents.
 * Key = current state, Value = array of states it can transition TO.
 */
export const AGENT_STATUS_TRANSITIONS: Record<AgentStatusType, AgentStatusType[]> = {
  [AgentStatus.DRAFT]: [
    AgentStatus.TESTING,   // Ready to test
    AgentStatus.ARCHIVED,  // Abandon without ever going live
  ],
  [AgentStatus.TESTING]: [
    AgentStatus.DRAFT,     // Go back to edit
    AgentStatus.ACTIVE,    // Promote to production
    AgentStatus.ARCHIVED,  // Abandon after testing
  ],
  [AgentStatus.ACTIVE]: [
    AgentStatus.PAUSED,    // Temporarily disable
    AgentStatus.ARCHIVED,  // Retire permanently
  ],
  [AgentStatus.PAUSED]: [
    AgentStatus.ACTIVE,    // Re-enable
    AgentStatus.ARCHIVED,  // Retire permanently
  ],
  [AgentStatus.ARCHIVED]: [], // Terminal state - no transitions out
};

/**
 * Check if a transition from one status to another is allowed.
 */
export function isValidTransition(
  from: AgentStatusType,
  to: AgentStatusType
): boolean {
  const allowed = AGENT_STATUS_TRANSITIONS[from];
  return allowed?.includes(to) ?? false;
}

/**
 * Get the list of allowed next states from a given state.
 */
export function getAllowedTransitions(from: AgentStatusType): AgentStatusType[] {
  return AGENT_STATUS_TRANSITIONS[from] ?? [];
}

/**
 * Check if an agent status allows making calls.
 */
export function canMakeCalls(status: AgentStatusType): boolean {
  return status === AgentStatus.ACTIVE;
}

/**
 * Check if an agent status allows making TEST calls (internal only).
 */
export function canMakeTestCalls(status: AgentStatusType): boolean {
  return status === AgentStatus.TESTING || status === AgentStatus.ACTIVE;
}

/**
 * Check if an agent status allows editing the agent configuration.
 */
export function canEditAgent(status: AgentStatusType): boolean {
  return status === AgentStatus.DRAFT || status === AgentStatus.TESTING;
}

/**
 * Check if an agent is in a terminal (read-only) state.
 */
export function isTerminalState(status: AgentStatusType): boolean {
  return status === AgentStatus.ARCHIVED;
}

/**
 * UI display information for each status.
 */
export const AGENT_STATUS_DISPLAY: Record<AgentStatusType, {
  label: string;
  description: string;
  variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive';
  icon: 'draft' | 'testing' | 'active' | 'paused' | 'archived';
}> = {
  [AgentStatus.DRAFT]: {
    label: 'Draft',
    description: 'Agent is being configured. No calls allowed.',
    variant: 'secondary',
    icon: 'draft',
  },
  [AgentStatus.TESTING]: {
    label: 'Testing',
    description: 'Test calls allowed from internal tools. Not public.',
    variant: 'warning',
    icon: 'testing',
  },
  [AgentStatus.ACTIVE]: {
    label: 'Active',
    description: 'Full production mode. All calls allowed.',
    variant: 'success',
    icon: 'active',
  },
  [AgentStatus.PAUSED]: {
    label: 'Paused',
    description: 'Temporarily disabled. No new calls allowed.',
    variant: 'warning',
    icon: 'paused',
  },
  [AgentStatus.ARCHIVED]: {
    label: 'Archived',
    description: 'Read-only. Cannot be used for calls or edited.',
    variant: 'destructive',
    icon: 'archived',
  },
};

/**
 * Action labels for transitions between states.
 */
export const TRANSITION_LABELS: Record<string, string> = {
  [`${AgentStatus.DRAFT}_${AgentStatus.TESTING}`]: 'Move to Testing',
  [`${AgentStatus.DRAFT}_${AgentStatus.ARCHIVED}`]: 'Archive',
  [`${AgentStatus.TESTING}_${AgentStatus.DRAFT}`]: 'Back to Draft',
  [`${AgentStatus.TESTING}_${AgentStatus.ACTIVE}`]: 'Publish',
  [`${AgentStatus.TESTING}_${AgentStatus.ARCHIVED}`]: 'Archive',
  [`${AgentStatus.ACTIVE}_${AgentStatus.PAUSED}`]: 'Pause',
  [`${AgentStatus.ACTIVE}_${AgentStatus.ARCHIVED}`]: 'Archive',
  [`${AgentStatus.PAUSED}_${AgentStatus.ACTIVE}`]: 'Resume',
  [`${AgentStatus.PAUSED}_${AgentStatus.ARCHIVED}`]: 'Archive',
};

/**
 * Get the label for a transition action.
 */
export function getTransitionLabel(from: AgentStatusType, to: AgentStatusType): string {
  return TRANSITION_LABELS[`${from}_${to}`] ?? `Move to ${AGENT_STATUS_DISPLAY[to].label}`;
}

/**
 * Error thrown when an invalid status transition is attempted.
 */
export class InvalidStatusTransitionError extends Error {
  constructor(
    public readonly from: AgentStatusType,
    public readonly to: AgentStatusType,
    public readonly agentId?: string
  ) {
    const allowed = getAllowedTransitions(from).join(', ') || 'none';
    super(
      `Invalid agent status transition from ${from} to ${to}. ` +
      `Allowed transitions from ${from}: [${allowed}]` +
      (agentId ? ` (Agent: ${agentId})` : '')
    );
    this.name = 'InvalidStatusTransitionError';
  }
}

/**
 * Error thrown when an operation is not allowed for the current agent status.
 */
export class AgentStatusBlockedError extends Error {
  constructor(
    public readonly status: AgentStatusType,
    public readonly operation: string,
    public readonly agentId?: string
  ) {
    super(
      `Operation '${operation}' is not allowed for agent in ${status} status` +
      (agentId ? ` (Agent: ${agentId})` : '')
    );
    this.name = 'AgentStatusBlockedError';
  }
}
