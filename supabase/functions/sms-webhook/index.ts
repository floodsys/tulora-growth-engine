import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface SMSWebhookEvent {
  type: 'sms_delivery_status' | 'sms_received'
  message_id?: string
  from?: string
  to?: string
  message?: string
  status?: string
  timestamp?: string
  error_code?: string
  error_message?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service key for webhook processing
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const webhookData: SMSWebhookEvent = await req.json()
    console.log('SMS webhook received:', webhookData)

    if (webhookData.type === 'sms_delivery_status') {
      // Update delivery status for outbound message
      if (webhookData.message_id) {
        const { error: updateError } = await supabaseClient
          .from('sms_messages')
          .update({
            delivery_status: webhookData.status || 'unknown',
            delivery_timestamp: webhookData.timestamp ? new Date(webhookData.timestamp) : new Date(),
            error_code: webhookData.error_code,
            error_message: webhookData.error_message,
            metadata: {
              webhook_data: webhookData,
            },
          })
          .eq('provider_message_id', webhookData.message_id)

        if (updateError) {
          console.error('Failed to update SMS delivery status:', updateError)
        }
      }
    } else if (webhookData.type === 'sms_received') {
      // Handle inbound SMS
      if (webhookData.from && webhookData.to && webhookData.message) {
        // Find the organization that owns this number
        const { data: numberData } = await supabaseClient
          .from('retell_numbers')
          .select('organization_id, id')
          .eq('e164', webhookData.to)
          .eq('sms_enabled', true)
          .single()

        if (numberData) {
          // Store inbound SMS
          const { error: insertError } = await supabaseClient
            .from('sms_messages')
            .insert({
              organization_id: numberData.organization_id,
              number_id: numberData.id,
              direction: 'inbound',
              from_number: webhookData.from,
              to_number: webhookData.to,
              message_body: webhookData.message,
              delivery_status: 'received',
              delivery_timestamp: webhookData.timestamp ? new Date(webhookData.timestamp) : new Date(),
              provider_message_id: webhookData.message_id,
              metadata: {
                webhook_data: webhookData,
              },
            })

          if (insertError) {
            console.error('Failed to store inbound SMS:', insertError)
          }

          // Track usage for inbound SMS
          await supabaseClient
            .from('usage_events')
            .insert({
              organization_id: numberData.organization_id,
              event_type: 'sms_received',
              resource_type: 'sms_message',
              quantity: 1,
              metadata: {
                from_number: webhookData.from,
                to_number: webhookData.to,
                message_length: webhookData.message.length,
              },
            })
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('SMS webhook error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})