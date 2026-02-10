import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { requireOrgActive, createBlockedResponse } from '../_shared/org-guard.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  const corr = crypto.randomUUID()
  
  try {
    // 1. Parse body FIRST
    const { knowledgeBaseId, organizationId } = await req.json()
    
    if (!knowledgeBaseId || !organizationId) {
      return new Response(JSON.stringify({ 
        error: 'knowledgeBaseId and organizationId required',
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
      action: 'retell.kb.refresh',
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
    
    // Update KB status with tenant constraint
    const { data, error } = await supabaseAdmin
      .from('retell_knowledge_bases')
      .update({ 
        last_indexed_at: new Date().toISOString(),
        status: 'indexing'
      })
      .eq('id', knowledgeBaseId)
      .eq('organization_id', organizationId)
      .select()
      .single()
    
    if (error) {
      console.error(`[${corr}] KB refresh error:`, error)
      return new Response(JSON.stringify({ 
        error: 'Failed to refresh knowledge base', 
        corr 
      }), { 
        status: 500, 
        headers: corsHeaders 
      })
    }
    
    // TODO: Trigger actual Retell API refresh
    // This would be added when implementing the Retell API integration
    // const { RETELL_API_KEY } = await import('../_shared/env.ts')
    // const retellApiKey = RETELL_API_KEY()
    // await fetch(`https://api.retellai.com/refresh-kb/${knowledgeBaseId}`, ...)
    
    // Log the successful refresh
    await supabase.rpc('log_event', {
      p_org_id: organizationId,
      p_action: 'retell.kb.refreshed',
      p_target_type: 'retell_knowledge_base',
      p_target_id: knowledgeBaseId,
      p_status: 'success',
      p_channel: 'audit',
      p_metadata: {
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
