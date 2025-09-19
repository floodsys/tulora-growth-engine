import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { requireOrgActive, createBlockedResponse, requireOrgIpAllowed, createIpBlockedResponse } from '../_shared/org-guard.ts'
import { requireEntitlement, getCurrentCount } from '../_shared/entitlements.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PublishAgentRequest {
  agentId: string
  organizationId: string
}

serve(async (req) => {
  console.log('=== Retell Agent Publish Request ===')
  console.log('Request method:', req.method)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
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

    const { agentId, organizationId }: PublishAgentRequest = await req.json()

    if (!agentId || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'agentId and organizationId are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check organization status
    const guardResult = await requireOrgActive({
      organizationId,
      action: 'retell.agent.publish',
      path: '/retell-agents-publish',
      method: req.method,
      supabase
    })

    if (!guardResult.ok) {
      return createBlockedResponse(guardResult, corsHeaders)
    }

    // Check IP allowlist
    const ipGuardResult = await requireOrgIpAllowed(req, organizationId, supabase)
    if (!ipGuardResult.ok) {
      const corr = crypto.randomUUID()
      console.log(`[${corr}] IP blocked for org ${organizationId}: ${ipGuardResult.clientIp}`)
      return createIpBlockedResponse(ipGuardResult, corsHeaders, corr)
    }

    // Check entitlements for agent publishing
    const corr = crypto.randomUUID()
    const currentAgentCount = await getCurrentCount(supabase, organizationId, 'agents')
    const entitlementCheck = await requireEntitlement(supabase, organizationId, {
      limitKey: 'agents',
      currentCount: currentAgentCount
    }, corr)

    if (!entitlementCheck.ok) {
      console.log(`[${corr}] Agent publishing blocked by entitlements:`, entitlementCheck.body)
      return new Response(
        JSON.stringify(entitlementCheck.body),
        { 
          status: entitlementCheck.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check advancedAnalytics feature for analytics capabilities
    const analyticsCorr = crypto.randomUUID();
    const analyticsGate = await requireEntitlement(supabase, organizationId, { feature: "advancedAnalytics" }, analyticsCorr);
    if (!analyticsGate.ok) {
      console.log(`[${analyticsCorr}] Advanced analytics blocked by entitlements:`, analyticsGate.body)
      return new Response(
        JSON.stringify(analyticsGate.body),
        { 
          status: analyticsGate.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get agent configuration from database
    const { data: agent, error: agentError } = await supabase
      .from('retell_agents')
      .select('*')
      .eq('agent_id', agentId)
      .eq('organization_id', organizationId)
      .single()

    if (agentError || !agent) {
      console.error('Agent not found:', agentError)
      return new Response(
        JSON.stringify({ error: 'Agent not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Prepare agent configuration for Retell API
    const retellConfig = {
      agent_name: agent.name,
      voice_id: agent.voice_id,
      voice_model: agent.voice_model || 'eleven_labs',
      language: agent.language,
      response_engine: {
        type: 'retell_llm',
        llm_id: 'retell-llm-general'
      },
      voice_settings: {
        speed: agent.voice_speed,
        temperature: agent.voice_temperature,
        volume: agent.volume,
        normalize_for_speech: agent.normalize_for_speech,
      },
      advanced_settings: {
        backchannel_enabled: agent.backchannel_enabled,
        backchannel_frequency: agent.backchannel_frequency,
        pronunciation_dictionary: agent.pronunciation_dict,
        max_call_duration_ms: agent.max_call_duration_ms,
        end_call_after_silence_ms: agent.end_call_after_silence_ms,
        begin_message_delay_ms: agent.begin_message_delay_ms,
      },
      telephony: {
        voicemail_option: agent.voicemail_option === 'enabled',
      },
      privacy_and_storage: {
        data_storage_setting: agent.data_storage_setting,
        opt_in_signed_url: agent.opt_in_signed_url,
      }
    }

    // Add transfer settings if enabled
    if (agent.transfer_mode !== 'disabled' && agent.transfer_number) {
      retellConfig.telephony.transfer_number = agent.transfer_number
      retellConfig.telephony.transfer_mode = agent.transfer_mode
    }

    // Add webhook URL if configured
    if (agent.webhook_url) {
      retellConfig.webhook_url = agent.webhook_url
    }

    // Add DTMF settings if enabled
    if (agent.settings?.dtmf?.enabled) {
      retellConfig.dtmf_options = {
        enabled: true,
        max_digits: agent.settings.dtmf.maxDigits || 10,
        termination_key: agent.settings.dtmf.termKey || '#',
        timeout_ms: agent.settings.dtmf.timeoutMs || 5000
      }
      
      // Also include in metadata for runtime access
      retellConfig.metadata = {
        ...retellConfig.metadata,
        dtmf: agent.settings.dtmf
      }
    }

    // Publish to Retell API
    const { RETELL_API_KEY } = await import('../_shared/env.ts')
    const retellApiKey = RETELL_API_KEY()

    console.log('Publishing agent to Retell API:', agentId)
    const retellResponse = await fetch(`https://api.retellai.com/update-agent/${agentId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(retellConfig)
    })

    if (!retellResponse.ok) {
      const errorText = await retellResponse.text()
      console.error('Retell API error:', retellResponse.status, errorText)
      
      // Log the failed publish attempt
      await supabase.rpc('log_event', {
        p_org_id: organizationId,
        p_action: 'retell.agent.publish_failed',
        p_target_type: 'retell_agent',
        p_target_id: agentId,
        p_status: 'error',
        p_channel: 'audit',
        p_metadata: {
          error: errorText,
          retell_status: retellResponse.status,
          timestamp: new Date().toISOString()
        }
      })

      return new Response(
        JSON.stringify({ 
          error: 'Failed to publish agent to Retell', 
          details: errorText 
        }),
        { 
          status: retellResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const publishedAgent = await retellResponse.json()
    console.log('Successfully published agent:', agentId)

    // Update agent status in database
    const newVersion = agent.version + 1
    const { error: updateError } = await supabase
      .from('retell_agents')
      .update({
        status: 'published',
        version: newVersion,
        published_at: new Date().toISOString()
      })
      .eq('id', agent.id)

    if (updateError) {
      console.error('Failed to update agent status:', updateError)
    }

    // Log the successful publish
    await supabase.rpc('log_event', {
      p_org_id: organizationId,
      p_action: 'retell.agent.published',
      p_target_type: 'retell_agent',
      p_target_id: agentId,
      p_status: 'success',
      p_channel: 'audit',
      p_metadata: {
        version: newVersion,
        agent_name: agent.name,
        voice_id: agent.voice_id,
        timestamp: new Date().toISOString()
      }
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        version: newVersion,
        retell_agent: publishedAgent
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Unexpected error in retell-agents-publish:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})