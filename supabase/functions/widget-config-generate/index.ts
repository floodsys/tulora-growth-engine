import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireEntitlement, getCurrentCount } from '../_shared/entitlements.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('seat_active', true)
      .single()

    if (!membership) {
      return new Response(
        JSON.stringify({ error: 'No active organization membership' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { agentId, widgetType = 'chat', config = {} } = body

    // Check widget entitlements
    const corr = crypto.randomUUID()
    const currentWidgetCount = await getCurrentCount(supabase, membership.organization_id, 'widgets')
    const entitlementCheck = await requireEntitlement(supabase, membership.organization_id, {
      feature: 'widgets',
      limitKey: 'widgets',
      currentCount: currentWidgetCount
    }, corr)

    if (!entitlementCheck.ok) {
      console.log(`[${corr}] Widget creation blocked by entitlements:`, entitlementCheck.body)
      return new Response(
        JSON.stringify(entitlementCheck.body),
        { 
          status: entitlementCheck.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify agent belongs to organization
    const { data: agent } = await supabase
      .from('retell_agents')
      .select('*')
      .eq('agent_id', agentId)
      .eq('organization_id', membership.organization_id)
      .eq('status', 'published')
      .single()

    if (!agent) {
      return new Response(
        JSON.stringify({ error: 'Agent not found or not published' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate public key
    const publicKey = `pk_${membership.organization_id}_${agentId.slice(-8)}`

    // Upsert widget configuration
    const { data: widgetConfig, error } = await supabase
      .from('widget_configs')
      .upsert({
        organization_id: membership.organization_id,
        agent_id: agentId,
        widget_type: widgetType,
        config_data: config,
        public_key: publicKey,
        allowed_domains: config.allowed_domains || [],
        require_recaptcha: config.require_recaptcha || false,
        is_active: true,
      }, {
        onConflict: 'organization_id,agent_id,widget_type'
      })
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({
        success: true,
        public_key: publicKey,
        widget_config: widgetConfig,
        embed_url: getEmbedUrl(widgetType, publicKey, agentId, config),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error generating widget config:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function getEmbedUrl(widgetType: string, publicKey: string, agentId: string, config: any): string {
  const baseUrl = 'https://widget.retellai.com'
  const params = new URLSearchParams({
    pk: publicKey,
    agent: agentId,
    type: widgetType,
    theme: config.theme || 'light',
  })

  return `${baseUrl}/${widgetType}.js?${params.toString()}`
}