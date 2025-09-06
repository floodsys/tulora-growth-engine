import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'npm:resend@2.0.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ContactSalesRequest {
  name: string
  email: string
  company?: string
  product_line: 'leadgen' | 'support'
  expected_volume?: string
  notes?: string
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONTACT-SALES] ${step}${detailsStr}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    logStep('Contact sales request started')

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new Error('RESEND_API_KEY is not set')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Get request data
    const { name, email, company, product_line, expected_volume, notes }: ContactSalesRequest = await req.json()
    logStep('Request data received', { name, email, company, product_line })

    // Get user if authenticated
    let userId: string | null = null
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const { data: userData } = await supabase.auth.getUser(token)
        userId = userData.user?.id || null
        logStep('User authenticated', { userId })
      } catch (error) {
        logStep('No valid authentication', { error: error.message })
      }
    }

    // Insert lead into database
    const { data: leadData, error: leadError } = await supabase
      .from('leads')
      .insert({
        user_id: userId,
        name,
        email,
        company,
        product_line,
        expected_volume,
        notes,
        source: 'contact_sales',
        status: 'new'
      })
      .select()
      .single()

    if (leadError) {
      logStep('Database insert error', { error: leadError })
      throw new Error(`Failed to save lead: ${leadError.message}`)
    }

    logStep('Lead saved to database', { leadId: leadData.id })

    // Send email to sales team
    const resend = new Resend(resendKey)
    
    const productLineLabel = product_line === 'leadgen' ? 'AI Lead Generation' : 'AI Customer Service'
    
    const emailHtml = `
      <h2>New Enterprise Sales Inquiry</h2>
      <p>A new enterprise prospect has submitted a contact sales request:</p>
      
      <h3>Contact Information</h3>
      <ul>
        <li><strong>Name:</strong> ${name}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Company:</strong> ${company || 'Not provided'}</li>
      </ul>
      
      <h3>Interest Details</h3>
      <ul>
        <li><strong>Product Line:</strong> ${productLineLabel}</li>
        <li><strong>Expected Volume:</strong> ${expected_volume || 'Not provided'}</li>
      </ul>
      
      ${notes ? `
        <h3>Additional Notes</h3>
        <p>${notes}</p>
      ` : ''}
      
      <h3>Lead Details</h3>
      <ul>
        <li><strong>Lead ID:</strong> ${leadData.id}</li>
        <li><strong>Submission Time:</strong> ${new Date().toISOString()}</li>
        <li><strong>User ID:</strong> ${userId || 'Anonymous'}</li>
      </ul>
      
      <p>Please follow up with this prospect as soon as possible.</p>
    `

    const { data: emailResponse, error: emailError } = await resend.emails.send({
      from: 'AI Platform <noreply@tulora.io>',
      to: ['sales@tulora.io'],
      subject: `New Enterprise Lead: ${productLineLabel} - ${company || name}`,
      html: emailHtml,
      reply_to: email
    })

    if (emailError) {
      logStep('Email send error', { error: emailError })
      // Don't fail the request if email fails, but log it
      console.error('Failed to send notification email:', emailError)
    } else {
      logStep('Notification email sent', { emailId: emailResponse?.id })
    }

    // Send confirmation email to prospect
    const confirmationHtml = `
      <h2>Thank you for your interest in ${productLineLabel}!</h2>
      <p>Hi ${name},</p>
      
      <p>Thank you for reaching out about our ${productLineLabel} enterprise solution. We've received your inquiry and our sales team will be in touch within 24 hours.</p>
      
      <h3>What's Next?</h3>
      <ul>
        <li>Our sales team will review your requirements</li>
        <li>We'll schedule a personalized demo based on your needs</li>
        <li>We'll provide custom pricing and implementation options</li>
      </ul>
      
      <p>In the meantime, feel free to explore our platform or reach out if you have any immediate questions.</p>
      
      <p>Best regards,<br>
      The Tulora AI Team</p>
      
      <p><small>Reference ID: ${leadData.id}</small></p>
    `

    const { error: confirmationError } = await resend.emails.send({
      from: 'Tulora AI <hello@tulora.io>',
      to: [email],
      subject: `Thank you for your interest in ${productLineLabel}`,
      html: confirmationHtml
    })

    if (confirmationError) {
      logStep('Confirmation email error', { error: confirmationError })
    } else {
      logStep('Confirmation email sent')
    }

    return new Response(JSON.stringify({ 
      success: true, 
      leadId: leadData.id,
      message: 'Contact request submitted successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logStep('ERROR', { message: errorMessage })
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})