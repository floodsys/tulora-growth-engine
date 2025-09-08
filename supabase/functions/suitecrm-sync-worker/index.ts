import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OutboxEntry {
  id: string
  lead_id: string
  organization_id: string
  attempt_count: number
  next_attempt_at: string
  status: string
  last_error?: string
}

async function processOutboxEntries() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Get pending entries that are due for processing (max 5 concurrent)
    const { data: entries, error } = await supabase
      .from('crm_outbox')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lte('next_attempt_at', new Date().toISOString())
      .order('next_attempt_at', { ascending: true })
      .limit(5)

    if (error) {
      console.error('Failed to fetch outbox entries:', error)
      return { processed: 0, errors: 1 }
    }

    if (!entries || entries.length === 0) {
      console.log('No pending outbox entries to process')
      return { processed: 0, errors: 0 }
    }

    console.log(`Processing ${entries.length} outbox entries`)

    let processed = 0
    let errors = 0

    // Process entries with limited concurrency
    const promises = entries.map(async (entry: OutboxEntry) => {
      try {
        // Mark as processing
        await supabase
          .from('crm_outbox')
          .update({ 
            status: 'processing',
            updated_at: new Date().toISOString()
          })
          .eq('id', entry.id)

        // Call the sync function
        const syncResponse = await fetch(`${supabaseUrl}/functions/v1/suitecrm-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ lead_id: entry.lead_id })
        })

        const syncResult = await syncResponse.json()

        if (syncResult.success) {
          console.log(`✅ Successfully processed lead ${entry.lead_id}`)
          processed++
        } else {
          console.error(`❌ Failed to process lead ${entry.lead_id}:`, syncResult.error)
          errors++
        }

      } catch (error) {
        console.error(`❌ Error processing outbox entry ${entry.id}:`, error)
        
        // Reset status to failed so it can be retried
        await supabase
          .from('crm_outbox')
          .update({ 
            status: 'failed',
            last_error: error instanceof Error ? error.message : 'Unknown worker error',
            updated_at: new Date().toISOString()
          })
          .eq('id', entry.id)
        
        errors++
      }
    })

    // Wait for all processing to complete
    await Promise.all(promises)

    console.log(`Worker completed: ${processed} processed, ${errors} errors`)
    
    return { processed, errors }

  } catch (error) {
    console.error('Worker error:', error)
    return { processed: 0, errors: 1 }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('SuiteCRM Sync Worker started')
    
    const result = await processOutboxEntries()

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${result.processed} entries, ${result.errors} errors`,
        ...result
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Worker execution error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown worker error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})