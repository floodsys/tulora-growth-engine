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

interface LeadData {
  inquiry_type: 'enterprise';
  full_name: string;
  email: string;
  company: string;
  product_interest: string;
  product_line: string;
  additional_requirements: string;
  expected_volume_label: string;
  expected_volume_value?: string; // Will be auto-derived by trigger
  accept_privacy: boolean;
  marketing_opt_in: boolean;
  page_url?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  ip_country?: string;
  // Legacy fields for backward compatibility
  name?: string;
  notes?: string;
  legacy_expected_volume?: string;
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

    // Use service role client to bypass RLS for inserts
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Get request data
    const requestData: ContactSalesRequest = await req.json()
    logStep('Request data received', { 
      name: requestData.name, 
      email: requestData.email, 
      company: requestData.company, 
      product_line: requestData.product_line 
    })

    // Validate required fields
    if (!requestData.name || !requestData.email) {
      throw new Error('Missing required fields: name and email are required')
    }

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

    // Normalize product_line mapping for new schema
    const productInterestMap: Record<string, string> = {
      'leadgen': 'AI Lead Generation',
      'support': 'AI Customer Service'
    };

    const productInterest = productInterestMap[requestData.product_line] || 'AI Lead Generation';

    // Prepare normalized lead data according to new schema
    const leadData: LeadData = {
      inquiry_type: 'enterprise',
      full_name: requestData.name.trim(),
      email: requestData.email.trim().toLowerCase(),
      company: requestData.company?.trim() || '',
      product_interest: productInterest,
      product_line: requestData.product_line,
      additional_requirements: requestData.notes?.trim() || '',
      expected_volume_label: requestData.expected_volume?.trim() || '',
      accept_privacy: true, // Implied consent for enterprise inquiries
      marketing_opt_in: false, // Default to false, user can opt-in separately
      
      // Extract tracking data from request
      page_url: req.headers.get('referer') || undefined,
      referrer: req.headers.get('referer') || undefined,
      utm_source: new URL(req.url).searchParams.get('utm_source') || undefined,
      utm_medium: new URL(req.url).searchParams.get('utm_medium') || undefined,
      utm_campaign: new URL(req.url).searchParams.get('utm_campaign') || undefined,
      utm_term: new URL(req.url).searchParams.get('utm_term') || undefined,
      utm_content: new URL(req.url).searchParams.get('utm_content') || undefined,
      
      // Keep legacy fields for backward compatibility during transition
      name: requestData.name,
      notes: requestData.notes,
      legacy_expected_volume: requestData.expected_volume,
    };

    logStep('Inserting lead data with new schema', { 
      inquiry_type: leadData.inquiry_type,
      email: leadData.email,
      company: leadData.company,
      product_interest: leadData.product_interest
    })

    // Insert lead into database using service role (bypasses RLS)
    const { data: savedLead, error: leadError } = await supabase
      .from('leads')
      .insert(leadData)
      .select()
      .single()

    if (leadError) {
      logStep('Database insert error', { error: leadError })
      throw new Error(`Failed to save lead: ${leadError.message}`)
    }

    logStep('Lead saved to database', { leadId: savedLead.id })

    // Send email to sales team
    const resend = new Resend(resendKey)
    
    const emailHtml = `
      <h2>New Enterprise Sales Inquiry</h2>
      <p>A new enterprise prospect has submitted a contact sales request:</p>
      
      <h3>Contact Information</h3>
      <ul>
        <li><strong>Name:</strong> ${leadData.full_name}</li>
        <li><strong>Email:</strong> ${leadData.email}</li>
        <li><strong>Company:</strong> ${leadData.company || 'Not provided'}</li>
      </ul>
      
      <h3>Interest Details</h3>
      <ul>
        <li><strong>Product Line:</strong> ${leadData.product_interest}</li>
        <li><strong>Expected Volume:</strong> ${leadData.expected_volume_label || 'Not provided'}</li>
        <li><strong>Normalized Volume:</strong> ${savedLead.expected_volume_value || 'Not derived'}</li>
      </ul>
      
      ${leadData.additional_requirements ? `
        <h3>Additional Requirements</h3>
        <p>${leadData.additional_requirements}</p>
      ` : ''}
      
      <h3>Tracking Information</h3>
      <ul>
        <li><strong>Page URL:</strong> ${leadData.page_url || 'Not available'}</li>
        <li><strong>Referrer:</strong> ${leadData.referrer || 'Direct'}</li>
        ${leadData.utm_source ? `<li><strong>UTM Source:</strong> ${leadData.utm_source}</li>` : ''}
        ${leadData.utm_medium ? `<li><strong>UTM Medium:</strong> ${leadData.utm_medium}</li>` : ''}
        ${leadData.utm_campaign ? `<li><strong>UTM Campaign:</strong> ${leadData.utm_campaign}</li>` : ''}
      </ul>
      
      <h3>Lead Details</h3>
      <ul>
        <li><strong>Lead ID:</strong> ${savedLead.id}</li>
        <li><strong>Inquiry Type:</strong> ${savedLead.inquiry_type}</li>
        <li><strong>Submission Time:</strong> ${new Date().toISOString()}</li>
        <li><strong>User ID:</strong> ${userId || 'Anonymous'}</li>
      </ul>
      
      <p>Please follow up with this prospect as soon as possible.</p>
    `

    const { data: emailResponse, error: emailError } = await resend.emails.send({
      from: 'AI Platform <noreply@tulora.io>',
      to: ['sales@tulora.io'],
      subject: `New Enterprise Lead: ${leadData.product_interest} - ${leadData.company || leadData.full_name}`,
      html: emailHtml,
      reply_to: leadData.email
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
      <h2>Thank you for your interest in ${leadData.product_interest}!</h2>
      <p>Hi ${leadData.full_name},</p>
      
      <p>Thank you for reaching out about our ${leadData.product_interest} enterprise solution. We've received your inquiry and our sales team will be in touch within 24 hours.</p>
      
      <h3>Your Inquiry Details</h3>
      <ul>
        <li><strong>Company:</strong> ${leadData.company}</li>
        <li><strong>Product Interest:</strong> ${leadData.product_interest}</li>
        <li><strong>Expected Volume:</strong> ${leadData.expected_volume_label || 'Not specified'}</li>
      </ul>
      
      <h3>What's Next?</h3>
      <ul>
        <li>Our sales team will review your requirements</li>
        <li>We'll schedule a personalized demo based on your needs</li>
        <li>We'll provide custom pricing and implementation options</li>
      </ul>
      
      <p>In the meantime, feel free to explore our platform or reach out if you have any immediate questions.</p>
      
      <p>Best regards,<br>
      The Tulora AI Team</p>
      
      <p><small>Reference ID: ${savedLead.id}</small></p>
    `

    const { error: confirmationError } = await resend.emails.send({
      from: 'Tulora AI <hello@tulora.io>',
      to: [leadData.email],
      subject: `Thank you for your interest in ${leadData.product_interest}`,
      html: confirmationHtml
    })

    if (confirmationError) {
      logStep('Confirmation email error', { error: confirmationError })
    } else {
      logStep('Confirmation email sent')
    }

    return new Response(JSON.stringify({ 
      success: true, 
      leadId: savedLead.id,
      inquiry_type: savedLead.inquiry_type,
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
