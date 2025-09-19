import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireEntitlement } from '../_shared/entitlements.ts'
import { resolveWebhookTarget } from '../_shared/org-guard.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { callId, organizationId, transcript, metadata, agentId } = await req.json()

    // Check advancedAnalytics entitlement
    const corr = crypto.randomUUID();
    const gate = await requireEntitlement(supabase, organizationId, { feature: "advancedAnalytics" }, corr);
    if (!gate.ok) return new Response(JSON.stringify(gate.body), { status: gate.status, headers: corsHeaders });

    // Get agent and organization settings for webhook resolution
    const { data: agent, error: agentError } = await supabase
      .from('retell_agents')
      .select('settings, webhook_url')
      .eq('id', agentId)
      .eq('organization_id', organizationId)
      .single()

    if (agentError || !agent) {
      throw new Error('Agent not found')
    }

    // Get organization settings for webhook fallback
    const { data: org } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', organizationId)
      .single()

    const analysisSettings = agent.settings?.analysisSettings
    if (!analysisSettings?.enabled || !analysisSettings.fields?.length) {
      return new Response(JSON.stringify({ 
        message: 'Analysis not enabled for this agent',
        analysis: null 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Prepare analysis prompt
    const basePrompt = analysisSettings.analysisPrompt || 'Analyze this call and extract the requested information.'
    const customInstructions = analysisSettings.customInstructions || ''
    
    const fieldsPrompt = analysisSettings.fields
      .filter((field: any) => field.enabled)
      .map((field: any) => {
        let fieldPrompt = `${field.name} (${field.type}): ${field.prompt}`
        if (field.type === 'enum' && field.enumValues) {
          fieldPrompt += ` Options: ${field.enumValues.join(', ')}`
        }
        if (field.required) {
          fieldPrompt += ' (REQUIRED)'
        }
        return fieldPrompt
      })
      .join('\n')

    const fullPrompt = `${basePrompt}

${customInstructions}

Extract the following fields from this conversation:
${fieldsPrompt}

${analysisSettings.includeTranscript ? `Transcript: ${transcript}` : ''}
${analysisSettings.includeMetadata ? `Metadata: ${JSON.stringify(metadata)}` : ''}

Return your response as a JSON object with the field names as keys and the extracted values as values.`

    // Call OpenAI for analysis
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: analysisSettings.model || 'gpt-5-2025-08-07',
        messages: [
          {
            role: 'system',
            content: 'You are an expert call analyst. Extract the requested information accurately and return it as valid JSON.'
          },
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text()
      console.error('OpenAI API error:', errorData)
      throw new Error(`OpenAI API error: ${openaiResponse.status}`)
    }

    const openaiData = await openaiResponse.json()
    const analysisResult = openaiData.choices[0].message.content

    let parsedAnalysis
    try {
      parsedAnalysis = JSON.parse(analysisResult)
    } catch (e) {
      console.error('Failed to parse analysis result:', analysisResult)
      parsedAnalysis = { raw_analysis: analysisResult }
    }

    // Store analysis if configured
    if (analysisSettings.sendToDashboard) {
      const { error: insertError } = await supabase
        .from('retell_calls')
        .update({
          analysis_json: parsedAnalysis,
          updated_at: new Date().toISOString()
        })
        .eq('call_id', callId)
        .eq('organization_id', organizationId)

      if (insertError) {
        console.error('Error storing analysis:', insertError)
      }
    }

    // Send to webhook if configured using precedence resolution
    let webhookSent = false
    let webhookTarget = null
    if (analysisSettings.sendToWebhook) {
      const webhookResult = resolveWebhookTarget({ 
        agent: { webhook_url: agent.webhook_url }, 
        orgSettings: org?.settings 
      })
      
      if (webhookResult.url) {
        webhookTarget = webhookResult.target
        try {
          const webhookResponse = await fetch(webhookResult.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Event-Type': 'call.analysis.completed',
            },
            body: JSON.stringify({
              call_id: callId,
              organization_id: organizationId,
              agent_id: agentId,
              analysis: parsedAnalysis,
              timestamp: new Date().toISOString(),
              metadata: {
                model: analysisSettings.model,
                fields_analyzed: analysisSettings.fields.filter((f: any) => f.enabled).length,
                webhook_target: webhookResult.target
              }
            }),
          })
          webhookSent = webhookResponse.ok
          console.log('Webhook sent:', { corrId: corr, organizationId, target: webhookResult.target, success: webhookSent })
        } catch (webhookError) {
          console.error('Webhook delivery failed:', { corrId: corr, organizationId, target: webhookResult.target, error: webhookError })
        }
      }
    }

    return new Response(JSON.stringify({
      analysis: parsedAnalysis,
      stored: analysisSettings.sendToDashboard,
      webhook_sent: webhookSent,
      webhook_target: webhookTarget,
      timestamp: new Date().toISOString(),
      corr: corr
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in retell-analysis:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})