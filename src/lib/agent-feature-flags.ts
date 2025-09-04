// Agent feature flags configuration
import { 
  JESSICA_CALL, 
  JESSICA_WEB, 
  PAUL_CALL, 
  PAUL_WEB, 
  LAURA_CALL, 
  LAURA_WEB 
} from "@/config/publicConfig";

export interface AgentFeatureFlags {
  callMe: boolean;
  tryInBrowser: boolean;
}

export interface AgentConfig {
  slug: string;
  name: string;
  flags: AgentFeatureFlags;
}

// Feature flags for each agent
export const AGENT_FEATURE_FLAGS: Record<string, AgentFeatureFlags> = {
  jessica: {
    callMe: JESSICA_CALL,
    tryInBrowser: JESSICA_WEB,
  },
  paul: {
    callMe: PAUL_CALL,
    tryInBrowser: PAUL_WEB,
  },
  laura: {
    callMe: LAURA_CALL,
    tryInBrowser: LAURA_WEB,
  },
};

// Helper function to get feature flags for an agent
export function getAgentFeatureFlags(agentSlug: string): AgentFeatureFlags {
  return AGENT_FEATURE_FLAGS[agentSlug] || {
    callMe: false,
    tryInBrowser: false,
  };
}

// Helper function to check if agent has any enabled features
export function isAgentFullyEnabled(agentSlug: string): boolean {
  const flags = getAgentFeatureFlags(agentSlug);
  return flags.callMe && flags.tryInBrowser;
}

// Helper function to check if agent is completely disabled
export function isAgentDisabled(agentSlug: string): boolean {
  const flags = getAgentFeatureFlags(agentSlug);
  return !flags.callMe && !flags.tryInBrowser;
}