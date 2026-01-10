import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { requireOrgActive, createBlockedResponse } from '../_shared/org-guard.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  const corr = crypto.randomUUID()
  
  try {
    // 1. Parse body FIRST
    const { sourceId, enable_auto_refresh, organizationId } = await req.json()
    
    if (!sourceId || !organizationId) {
      return new Response(JSON.stringify({ 
        error: 'sourceId and organizationId required',
        corr 
      }), { 
        status: 400, 
        headers: corsHeaders 
      })
    }
    
    // 2. Auth check
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user) {
      console.error(`[${corr}] Unauthorized access attempt`)
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        corr 
      }), { 
        status: 401, 
        headers: corsHeaders 
      })
    }
    
    // 3. Admin/owner check
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single()
      
    if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
      console.error(`[${corr}] Non-admin access attempt by user ${user.id}`)
      return new Response(JSON.stringify({ 
        error: 'Admin access required',
        corr 
      }), { 
        status: 403, 
        headers: corsHeaders 
      })
    }
    
    // 4. Org active check
    const guardResult = await requireOrgActive({
      organizationId,
      action: 'retell.kb.update',
      path: req.url,
      method: req.method,
      supabase
    })
    
    if (!guardResult.ok) {
      console.error(`[${corr}] Org not active: ${guardResult.reason}`)
      return createBlockedResponse(guardResult, corsHeaders)
    }
    
    // 5. Use service-role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )
    
    // Get existing source with tenant constraint
    const { data: source, error: fetchError } = await supabaseAdmin
      .from('retell_kb_sources')
      .select('type, settings, knowledge_base_id')
      .eq('id', sourceId)
      .eq('organization_id', organizationId)  // Tenant constraint
      .single()
    
    if (fetchError || !source) {
      console.error(`[${corr}] Source not found:`, fetchError)
      return new Response(JSON.stringify({ 
        error: 'Source not found or access denied',
        corr
      }), { 
        status: 404, 
        headers: corsHeaders 
      })
    }
    
    // Verify KB ownership (double-check)
    const { data: kb, error: kbError } = await supabaseAdmin
      .from('retell_knowledge_bases')
      .select('organization_id')
      .eq('id', source.knowledge_base_id)
      .eq('organization_id', organizationId)  // Double-check
      .single()
    
    if (kbError || !kb) {
      console.error(`[${corr}] KB ownership verification failed:`, kbError)
      return new Response(JSON.stringify({ 
        error: 'Knowledge base not found or access denied',
        corr
      }), { 
        status: 404, 
        headers: corsHeaders 
      })
    }
    
    // Check if source type supports auto-refresh
    if (source.type !== 'url') {
      return new Response(JSON.stringify({ 
        error: 'Only URL sources support auto-refresh',
        corr
      }), { 
        status: 400, 
        headers: corsHeaders 
      })
    }
    
    // MERGE settings (don't clobber other fields)
    const { data, error } = await supabaseAdmin
      .from('retell_kb_sources')
      .update({ 
        settings: {
          ...(source.settings || {}),
          enable_auto_refresh
        }
      })
      .eq('id', sourceId)
      .eq('organization_id', organizationId)  // Tenant constraint on UPDATE
      .select()
      .single()
    
    if (error) {
      console.error(`[${corr}] Source update error:`, error)
      return new Response(JSON.stringify({ 
        error: 'Failed to update source', 
        corr 
      }), { 
        status: 500, 
        headers: corsHeaders 
      })
    }
    
    // Log the successful update
    await supabase.rpc('log_event', {
      p_org_id: organizationId,
      p_action: 'retell.kb.source_updated',
      p_target_type: 'retell_kb_source',
      p_target_id: sourceId,
      p_status: 'success',
      p_channel: 'audit',
      p_metadata: {
        enable_auto_refresh,
        user_id: user.id,
        timestamp: new Date().toISOString()
      }
    })
    
    return new Response(JSON.stringify(data), { 
      status: 200, 
      headers: corsHeaders 
    })
  } catch (error) {
    console.error(`[${corr}] Unexpected error:`, error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      corr 
    }), { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})
