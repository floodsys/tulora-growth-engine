import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AgentProfileUpdate {
  name?: string
  status?: 'active' | 'disabled'
  is_default?: boolean
  first_message_mode?: 'assistant_speaks' | 'assistant_waits' | 'model_generated'
  first_message?: string
  system_prompt?: string
  voice?: string
  language?: string
  temperature?: number
  max_tokens?: number
  call_recording_enabled?: boolean
  warm_transfer_enabled?: boolean
  transfer_number?: string
  settings?: Record<string, any>
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log('Request method:', req.method)
  console.log('Request URL:', req.url)

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

    // For function invocation, we get the data from the request body
    const requestData = await req.json()
    console.log('Request data:', JSON.stringify(requestData))
    
    const { method, agentId, ...updates } = requestData

    console.log(`${method} request for agent: ${agentId}`)

    if (method === 'GET') {
      // Get agent profile
      const { data: agent, error } = await supabase
        .from('agent_profiles')
        .select('*')
        .eq('id', agentId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching agent:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch agent' }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      if (!agent) {
        console.log('Agent not found:', agentId)
        return new Response(
          JSON.stringify({ error: 'Agent not found' }),
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      return new Response(
        JSON.stringify(agent),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (method === 'PATCH') {
      const agentUpdates: AgentProfileUpdate = updates
      
      console.log('Agent updates:', agentUpdates)

      // Validate transfer_number if provided
      if (agentUpdates.transfer_number && !/^\+\d{7,15}$/.test(agentUpdates.transfer_number)) {
        return new Response(
          JSON.stringify({ error: 'Invalid transfer number format. Must be E.164 format (+1234567890)' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // First get the current agent to check organization
      const { data: currentAgent, error: fetchError } = await supabase
        .from('agent_profiles')
        .select('organization_id, is_default')
        .eq('id', agentId)
        .single()

      if (fetchError) {
        console.error('Error fetching current agent:', fetchError)
        return new Response(
          JSON.stringify({ error: 'Agent not found' }),
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // If setting as default, unset previous default
      if (agentUpdates.is_default === true && !currentAgent.is_default) {
        console.log('Unsetting previous default agents for org:', currentAgent.organization_id)
        
        const { error: unsetError } = await supabase
          .from('agent_profiles')
          .update({ is_default: false })
          .eq('organization_id', currentAgent.organization_id)
          .eq('is_default', true)

        if (unsetError) {
          console.error('Error unsetting previous default:', unsetError)
        }
      }

      // Update the agent
      const { data: updatedAgent, error: updateError } = await supabase
        .from('agent_profiles')
        .update(agentUpdates)
        .eq('id', agentId)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating agent:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update agent' }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log('Agent updated successfully:', updatedAgent.id)

      return new Response(
        JSON.stringify(updatedAgent),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: `Method ${method} not allowed` }),
      { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})