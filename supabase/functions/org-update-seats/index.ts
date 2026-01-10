/**
 * Organization Update Seats Edge Function
 * 
 * Manual endpoint to sync seat count to Stripe subscription.
 * Uses the shared billingSeats helper for consistency.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { syncStripeSeatsForOrg, SeatSyncResult } from '../_shared/billingSeats.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdateSeatsRequest {
  orgId: string
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ORG-UPDATE-SEATS] ${step}${detailsStr}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const corr = crypto.randomUUID();

  try {
    logStep('Function started', { corr })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header provided')

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) throw new Error('User not authenticated')

    const { orgId }: UpdateSeatsRequest = await req.json()
    logStep('Request data', { corr, orgId })

    // Verify user has admin access to this org
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userData.user.id)
      .single()

    // Also check if user is owner
    const { data: org } = await supabase
      .from('organizations')
      .select('owner_user_id')
      .eq('id', orgId)
      .single()

    const isOwner = org?.owner_user_id === userData.user.id
    const isAdmin = membership?.role === 'admin'

    if (!isOwner && !isAdmin) {
      throw new Error('Insufficient permissions - admin or owner access required')
    }

    // Use the shared seat sync helper
    logStep('Calling syncStripeSeatsForOrg', { corr, orgId })
    const result: SeatSyncResult = await syncStripeSeatsForOrg(supabase, orgId, corr)

    logStep('Seat sync result', { corr, ...result })

    if (!result.success && !result.skipped) {
      return new Response(JSON.stringify({ 
        error: result.error || 'Seat sync failed',
        message: result.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: result.message,
      oldQuantity: result.oldQuantity,
      newQuantity: result.newQuantity,
      subscriptionId: result.subscriptionId,
      skipped: result.skipped
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logStep('ERROR', { corr, message: errorMessage })
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
