import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { 
  AgentStatus, 
  AgentStatusType, 
  normalizeAgentStatus, 
  isValidTransition, 
  getAllowedTransitions,
  canEditAgent,
  AGENT_STATUS_DISPLAY,
  getTransitionLabel 
} from '@/lib/agents/types'

export interface RetellAgent {
  id: string
  organization_id: string
  agent_id: string
  name: string
  version: number
  voice_id?: string
  voice_model?: string
  language: string
  backchannel_enabled: boolean
  backchannel_frequency: number
  pronunciation_dict: any
  voice_speed: number
  voice_temperature: number
  volume: number
  normalize_for_speech: boolean
  max_call_duration_ms: number
  end_call_after_silence_ms: number
  begin_message_delay_ms: number
  voicemail_option: string
  data_storage_setting: string
  opt_in_signed_url: boolean
  webhook_url?: string
  transfer_number?: string
  transfer_mode: string
  kb_ids: string[]
  status: string
  is_active: boolean
  created_at: string
  updated_at: string
  published_at?: string
  testing_started_at?: string
  activated_at?: string
  paused_at?: string
  archived_at?: string
  settings?: any
}

export interface Voice {
  voice_id: string
  voice_name: string
  gender: string
  accent: string
  description?: string
  preview_url?: string
}

export const useRetellAgents = (organizationId?: string) => {
  const [agents, setAgents] = useState<RetellAgent[]>([])
  const [voices, setVoices] = useState<Voice[]>([])
  const [loading, setLoading] = useState(true)
  const [voicesLoading, setVoicesLoading] = useState(false)
  const { toast } = useToast()

  // Load agents
  const loadAgents = async () => {
    if (!organizationId) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('retell_agents')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAgents(data || [])
    } catch (error) {
      console.error('Error loading agents:', error)
      toast({
        title: "Error",
        description: "Failed to load agents.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Load voices
  const loadVoices = async () => {
    if (!organizationId) return

    try {
      setVoicesLoading(true)
      const { data, error } = await supabase.functions.invoke('retell-voices-list', {
        body: { organizationId }
      })

      if (error) throw error
      setVoices(data.voices || [])
    } catch (error) {
      console.error('Error loading voices:', error)
      toast({
        title: "Warning",
        description: "Could not load available voices.",
        variant: "destructive"
      })
    } finally {
      setVoicesLoading(false)
    }
  }

  // Create agent
  const createAgent = async (agentData: Partial<RetellAgent> & { agent_id: string }) => {
    if (!organizationId) return null

    try {
      const insertData = {
        organization_id: organizationId,
        agent_id: agentData.agent_id,
        name: agentData.name || 'Untitled Agent',
        language: agentData.language || 'en',
        voice_id: agentData.voice_id,
        voice_model: agentData.voice_model,
        status: agentData.status || AgentStatus.DRAFT,
        // Add other required fields with defaults
        version: 1,
        backchannel_enabled: false,
        backchannel_frequency: 0.8,
        pronunciation_dict: {},
        voice_speed: 1.0,
        voice_temperature: 1.0,
        volume: 1.0,
        normalize_for_speech: true,
        max_call_duration_ms: 1800000,
        end_call_after_silence_ms: 10000,
        begin_message_delay_ms: 800,
        voicemail_option: 'disabled',
        data_storage_setting: 'standard',
        opt_in_signed_url: false,
        transfer_mode: 'disabled',
        kb_ids: [],
        is_active: true,
      }

      const { data, error } = await supabase
        .from('retell_agents')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error

      setAgents(prev => [data, ...prev])
      
      toast({
        title: "Agent Created",
        description: "New agent has been created successfully.",
      })

      return data
    } catch (error) {
      console.error('Error creating agent:', error)
      toast({
        title: "Error",
        description: "Failed to create agent.",
        variant: "destructive"
      })
      return null
    }
  }

  // Update agent
  const updateAgent = async (agentId: string, updates: Partial<RetellAgent>) => {
    try {
      const { data, error } = await supabase
        .from('retell_agents')
        .update(updates)
        .eq('id', agentId)
        .select()
        .single()

      if (error) throw error

      setAgents(prev => prev.map(agent => 
        agent.id === agentId ? { ...agent, ...data } : agent
      ))

      return data
    } catch (error) {
      console.error('Error updating agent:', error)
      toast({
        title: "Error",
        description: "Failed to update agent.",
        variant: "destructive"
      })
      return null
    }
  }

  // Transition agent status (state machine enforced)
  const transitionAgentStatus = async (agentId: string, toStatus: AgentStatusType) => {
    try {
      const agent = agents.find(a => a.id === agentId)
      if (!agent) throw new Error('Agent not found')
      
      const currentStatus = normalizeAgentStatus(agent.status)
      
      // Validate transition is allowed
      if (!isValidTransition(currentStatus, toStatus)) {
        const allowed = getAllowedTransitions(currentStatus)
        toast({
          title: "Invalid Transition",
          description: `Cannot transition from ${currentStatus} to ${toStatus}. Allowed: ${allowed.join(', ') || 'none'}`,
          variant: "destructive"
        })
        return null
      }
      
      // Build update data with appropriate timestamps
      const updateData: Partial<RetellAgent> = {
        status: toStatus,
      }
      
      // Set timestamps based on transition
      const now = new Date().toISOString()
      switch (toStatus) {
        case AgentStatus.TESTING:
          (updateData as any).testing_started_at = now
          break
        case AgentStatus.ACTIVE:
          (updateData as any).activated_at = now
          break
        case AgentStatus.PAUSED:
          (updateData as any).paused_at = now
          break
        case AgentStatus.ARCHIVED:
          (updateData as any).archived_at = now
          break
      }
      
      const { data, error } = await supabase
        .from('retell_agents')
        .update(updateData)
        .eq('id', agentId)
        .select()
        .single()
      
      if (error) throw error
      
      setAgents(prev => prev.map(a => 
        a.id === agentId ? { ...a, ...data } : a
      ))
      
      const label = getTransitionLabel(currentStatus, toStatus)
      toast({
        title: `Agent ${AGENT_STATUS_DISPLAY[toStatus].label}`,
        description: `Agent status changed to ${AGENT_STATUS_DISPLAY[toStatus].label}.`,
      })
      
      return data
    } catch (error) {
      console.error('Error transitioning agent status:', error)
      toast({
        title: "Error",
        description: "Failed to update agent status.",
        variant: "destructive"
      })
      return null
    }
  }

  // Publish agent (TESTING → ACTIVE)
  const publishAgent = async (agentId: string) => {
    try {
      const agent = agents.find(a => a.id === agentId)
      if (!agent) throw new Error('Agent not found')
      
      const currentStatus = normalizeAgentStatus(agent.status)
      
      // Agent must be in TESTING to publish to ACTIVE
      if (currentStatus !== AgentStatus.TESTING && currentStatus !== AgentStatus.ACTIVE) {
        toast({
          title: "Cannot Publish",
          description: `Agent must be in TESTING status to publish. Current status: ${currentStatus}`,
          variant: "destructive"
        })
        return null
      }

      const { data, error } = await supabase.functions.invoke('retell-agents-publish', {
        body: { 
          agentId: agent.agent_id,
          organizationId: agent.organization_id
        }
      })

      if (error) throw error

      setAgents(prev => prev.map(a => 
        a.id === agentId ? { 
          ...a, 
          status: AgentStatus.ACTIVE,
          version: data.version,
          published_at: new Date().toISOString(),
          activated_at: currentStatus !== AgentStatus.ACTIVE ? new Date().toISOString() : a.activated_at
        } : a
      ))

      toast({
        title: "Agent Published",
        description: `Agent is now ACTIVE and published as version ${data.version}.`,
      })

      return data
    } catch (error: any) {
      console.error('Error publishing agent:', error)
      const message = error?.message || "Failed to publish agent."
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      })
      return null
    }
  }

  // Delete agent
  const deleteAgent = async (agentId: string) => {
    try {
      const { error } = await supabase
        .from('retell_agents')
        .update({ is_active: false })
        .eq('id', agentId)

      if (error) throw error

      setAgents(prev => prev.filter(agent => agent.id !== agentId))
      
      toast({
        title: "Agent Deleted",
        description: "Agent has been deleted successfully.",
      })
    } catch (error) {
      console.error('Error deleting agent:', error)
      toast({
        title: "Error",
        description: "Failed to delete agent.",
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    if (organizationId) {
      loadAgents()
      loadVoices()
    }
  }, [organizationId])

  // Attach knowledge bases to agents
  const attachKBToAgent = async (agentId: string, kbIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('retell_agents')
        .update({ kb_ids: kbIds })
        .eq('id', agentId)
        .select()
        .single()

      if (error) throw error

      setAgents(prev => prev.map(agent => 
        agent.id === agentId ? { ...agent, kb_ids: kbIds } : agent
      ))

      toast({
        title: "Knowledge Base Attached",
        description: "Knowledge base has been attached to the agent.",
      })

      return data
    } catch (error) {
      console.error('Error attaching KB to agent:', error)
      toast({
        title: "Error",
        description: "Failed to attach knowledge base to agent.",
        variant: "destructive"
      })
      return null
    }
  }

  // Get agent by ID
  const getAgent = (agentId: string) => {
    return agents.find(agent => agent.id === agentId)
  }

  // Update agent settings (alias for updateAgent)
  const updateAgentSettings = updateAgent

  return {
    agents,
    voices,
    loading,
    voicesLoading,
    loadAgents,
    loadVoices,
    createAgent,
    updateAgent,
    updateAgentSettings,
    transitionAgentStatus,
    publishAgent,
    deleteAgent,
    attachKBToAgent,
    getAgent,
    // Re-export status utilities for convenience
    AgentStatus,
    normalizeAgentStatus,
    getAllowedTransitions,
    canEditAgent,
    AGENT_STATUS_DISPLAY,
    getTransitionLabel,
  }
}
