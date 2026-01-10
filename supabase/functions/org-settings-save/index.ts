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
    // 1. Parse body FIRST to get organizationId
    const { organizationId, settings } = await req.json()
    
    if (!organizationId) {
      return new Response(JSON.stringify({ 
        error: 'organizationId required',
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
    
    // 3. Admin check
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
      action: 'org.settings.update',
      path: req.url,
      method: req.method,
      supabase
    })
    
    if (!guardResult.ok) {
      console.error(`[${corr}] Org not active: ${guardResult.reason}`)
      return createBlockedResponse(guardResult, corsHeaders)
    }
    
    // 5. Use service-role for operation
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )
    
    // Get existing settings for merge
    const { data: existing } = await supabaseAdmin
      .from('organizations')
      .select('settings')
      .eq('id', organizationId)
      .single()
    
    // Merge at TOP LEVEL (matching guard paths)
    const { data: updated, error } = await supabaseAdmin
      .from('organizations')
      .update({
        settings: {
          ...(existing?.settings ?? {}),  // Safe spread with ?? {}
          require_mfa: settings.require_mfa,  // TOP-LEVEL
          session_timeout_minutes: settings.session_timeout_minutes,  // TOP-LEVEL
          ip_allowlist_enabled: settings.ip_allowlist_enabled,
          ip_allowlist: settings.ip_allowlist,
          webhook_security_enabled: settings.webhook_security_enabled,
          audit_log_retention_days: settings.audit_log_retention_days
        }
      })
      .eq('id', organizationId)
      .select()
      .single()
    
    if (error) {
      console.error(`[${corr}] Settings save error:`, error)
      return new Response(JSON.stringify({ 
        error: 'Failed to save settings', 
        corr 
      }), { 
        status: 500, 
        headers: corsHeaders 
      })
    }
    
    // Log the successful update
    await supabase.rpc('log_event', {
      p_org_id: organizationId,
      p_action: 'org.settings.updated',
      p_target_type: 'organization',
      p_target_id: organizationId,
      p_status: 'success',
      p_channel: 'audit',
      p_metadata: {
        updated_fields: Object.keys(settings),
        user_id: user.id,
        timestamp: new Date().toISOString()
      }
    })
    
    return new Response(JSON.stringify(updated), { 
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
