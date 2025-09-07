import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'npm:resend@2.0.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ContactFormRequest {
  inquiry_type: 'contact' | 'enterprise'
  full_name?: string
  name?: string // backward compatibility
  email: string
  phone?: string
  company?: string
  message?: string // for contact forms
  product_line?: 'leadgen' | 'support' // legacy field
  product_interest?: string // new normalized field
  expected_volume?: string // legacy field name
  expected_volume_label?: string // new field name
  notes?: string // legacy field for additional_requirements
  additional_requirements?: string // new field name
  accept_privacy?: boolean
  marketing_opt_in?: boolean
}

interface ValidationError {
  field: string
  message: string
}

interface LeadData {
  inquiry_type: 'contact' | 'enterprise'
  full_name: string
  email: string
  phone?: string
  company?: string
  message?: string
  product_interest?: string
  product_line?: string
  additional_requirements?: string
  expected_volume_label?: string
  expected_volume_value?: string
  accept_privacy: boolean
  marketing_opt_in: boolean
  page_url?: string
  referrer?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  ip_country?: string
  // Legacy compatibility fields
  name?: string
  notes?: string
  legacy_expected_volume?: string
}

const logStep = (step: string, leadId?: string, status?: string) => {
  // Only log IDs and status, no PII
  const details = leadId ? `leadId: ${leadId}` : '';
  const statusInfo = status ? `, status: ${status}` : '';
  console.log(`[CONTACT-SUBMIT] ${step}${details}${statusInfo}`);
}

const trimField = (value: any): string => {
  return typeof value === 'string' ? value.trim() : '';
}

const normalizeFullName = (name: string): string => {
  // Normalize spacing: remove extra spaces, capitalize words properly
  return name.replace(/\s+/g, ' ').trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email);
}

const mapProductInterestToLine = (productInterest: string): string => {
  const mapping: Record<string, string> = {
    'AI Lead Generation': 'leadgen',
    'AI Customer Service': 'support',
    'leadgen': 'leadgen', // backward compatibility
    'support': 'support'  // backward compatibility
  };
  return mapping[productInterest] || 'leadgen';
}

const mapVolumeToCode = (volumeLabel: string): string => {
  const mapping: Record<string, string> = {
    '< 5,000 calls/month': 'lt_5k',
    '5,000-20,000 calls/month': '5k_20k', 
    '20,000-100,000 calls/month': '20k_100k',
    '> 100,000 calls/month': 'gt_100k',
    'Custom/Variable': 'custom'
  };
  return mapping[volumeLabel] || '';
}

const validatePayload = (data: ContactFormRequest): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  // Determine inquiry type
  const inquiryType = data.inquiry_type || (data.product_interest || data.product_line ? 'enterprise' : 'contact');
  
  // Get full_name from either field
  const fullName = trimField(data.full_name || data.name);
  const email = trimField(data.email);
  const phone = trimField(data.phone);
  const company = trimField(data.company);
  const message = trimField(data.message);
  const productInterest = trimField(data.product_interest);
  const expectedVolumeLabel = trimField(data.expected_volume_label || data.expected_volume);
  const additionalRequirements = trimField(data.additional_requirements || data.notes);

  // Validate common required fields
  if (!fullName) {
    errors.push({ field: 'full_name', message: 'Full name is required and cannot be empty' });
  }
  
  if (!email) {
    errors.push({ field: 'email', message: 'Email is required and cannot be empty' });
  } else if (!validateEmail(email)) {
    errors.push({ field: 'email', message: 'Email must be a valid email address' });
  }

  // Validate based on inquiry type
  if (inquiryType === 'contact') {
    if (!phone) {
      errors.push({ field: 'phone', message: 'Phone number is required for contact inquiries' });
    }
    if (!company) {
      errors.push({ field: 'company', message: 'Company name is required for contact inquiries' });
    }
    if (!message) {
      errors.push({ field: 'message', message: 'Message is required for contact inquiries' });
    }
  } else if (inquiryType === 'enterprise') {
    if (!company) {
      errors.push({ field: 'company', message: 'Company name is required for enterprise inquiries' });
    }
    if (!productInterest) {
      errors.push({ field: 'product_interest', message: 'Product interest is required for enterprise inquiries' });
    }
    if (!expectedVolumeLabel) {
      errors.push({ field: 'expected_volume_label', message: 'Expected volume is required for enterprise inquiries' });
    }
    if (!additionalRequirements) {
      errors.push({ field: 'additional_requirements', message: 'Additional requirements are required for enterprise inquiries' });
    }
    
    // Validate product interest mapping
    if (productInterest && !['AI Lead Generation', 'AI Customer Service', 'leadgen', 'support'].includes(productInterest)) {
      errors.push({ field: 'product_interest', message: 'Product interest must be "AI Lead Generation" or "AI Customer Service"' });
    }
    
    // Validate expected volume mapping
    if (expectedVolumeLabel && !mapVolumeToCode(expectedVolumeLabel)) {
      errors.push({ field: 'expected_volume_label', message: 'Expected volume must be one of the predefined options' });
    }
  }

  return errors;
}

const extractTrackingData = (req: Request): Partial<LeadData> => {
  const url = new URL(req.url);
  
  return {
    page_url: req.headers.get('referer') || undefined,
    referrer: req.headers.get('referer') || undefined,
    utm_source: url.searchParams.get('utm_source') || undefined,
    utm_medium: url.searchParams.get('utm_medium') || undefined,
    utm_campaign: url.searchParams.get('utm_campaign') || undefined,
    utm_term: url.searchParams.get('utm_term') || undefined,
    utm_content: url.searchParams.get('utm_content') || undefined,
    // Note: ip_country would need additional service to populate
    ip_country: undefined
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    logStep('Contact submission started')

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new Error('RESEND_API_KEY is not set')

    // Use service role client to bypass RLS for inserts
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Parse and validate request data
    const requestData: ContactFormRequest = await req.json()
    logStep('Request received', undefined, 'parsing')

    // Validate payload
    const validationErrors = validatePayload(requestData)
    if (validationErrors.length > 0) {
      logStep('Validation failed', undefined, 'error')
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Validation failed',
        errors: validationErrors
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Determine inquiry type
    const inquiryType = requestData.inquiry_type || (requestData.product_interest || requestData.product_line ? 'enterprise' : 'contact');
    
    // Normalize and prepare data
    const fullName = normalizeFullName(trimField(requestData.full_name || requestData.name));
    const email = trimField(requestData.email).toLowerCase();
    const productInterest = trimField(requestData.product_interest);
    const expectedVolumeLabel = trimField(requestData.expected_volume_label || requestData.expected_volume);
    
    // Extract tracking data
    const trackingData = extractTrackingData(req);

    // Get user if authenticated  
    let userId: string | null = null
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const { data: userData } = await supabase.auth.getUser(token)
        userId = userData.user?.id || null
        logStep('User authenticated', userId || undefined)
      } catch (error) {
        logStep('Authentication failed')
      }
    }

    // Prepare normalized lead data
    const leadData: LeadData = {
      inquiry_type: inquiryType as 'contact' | 'enterprise',
      full_name: fullName,
      email: email,
      phone: inquiryType === 'contact' ? trimField(requestData.phone) : undefined,
      company: trimField(requestData.company),
      message: inquiryType === 'contact' ? trimField(requestData.message) : undefined,
      product_interest: inquiryType === 'enterprise' ? productInterest : undefined,
      product_line: inquiryType === 'enterprise' ? mapProductInterestToLine(productInterest) : undefined,
      additional_requirements: inquiryType === 'enterprise' ? trimField(requestData.additional_requirements || requestData.notes) : undefined,
      expected_volume_label: inquiryType === 'enterprise' ? expectedVolumeLabel : undefined,
      expected_volume_value: inquiryType === 'enterprise' ? mapVolumeToCode(expectedVolumeLabel) : undefined,
      accept_privacy: requestData.accept_privacy ?? true,
      marketing_opt_in: requestData.marketing_opt_in ?? false,
      
      // Include tracking data
      ...trackingData,
      
      // Legacy compatibility fields
      name: fullName,
      notes: inquiryType === 'enterprise' ? trimField(requestData.additional_requirements || requestData.notes) : trimField(requestData.message),
      legacy_expected_volume: expectedVolumeLabel,
    };

    logStep('Data normalized', undefined, 'ready')

    // Insert lead into database using service role (bypasses RLS)
    const { data: savedLead, error: leadError } = await supabase
      .from('leads')
      .insert(leadData)
      .select('id, inquiry_type, email, company')
      .single()

    if (leadError) {
      logStep('Database insert failed', undefined, 'error')
      console.error('Lead insertion error:', leadError)
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to save submission',
        details: leadError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    logStep('Lead saved', savedLead.id, 'success')

    // Send notifications via email
    const resend = new Resend(resendKey)
    
    const isEnterprise = inquiryType === 'enterprise';
    const emailSubject = isEnterprise 
      ? `New Enterprise Lead: ${productInterest} - ${leadData.company}`
      : `New Contact Inquiry from ${leadData.company}`;

    const emailHtml = isEnterprise ? `
      <h2>New Enterprise Sales Inquiry</h2>
      <p>A new enterprise prospect has submitted a contact request:</p>
      
      <h3>Contact Information</h3>
      <ul>
        <li><strong>Name:</strong> ${leadData.full_name}</li>
        <li><strong>Email:</strong> ${leadData.email}</li>
        <li><strong>Company:</strong> ${leadData.company}</li>
      </ul>
      
      <h3>Interest Details</h3>
      <ul>
        <li><strong>Product Interest:</strong> ${leadData.product_interest}</li>
        <li><strong>Expected Volume:</strong> ${leadData.expected_volume_label}</li>
        <li><strong>Volume Code:</strong> ${leadData.expected_volume_value}</li>
      </ul>
      
      <h3>Requirements</h3>
      <p>${leadData.additional_requirements}</p>
      
      <p><strong>Lead ID:</strong> ${savedLead.id}</p>
    ` : `
      <h2>New Contact Inquiry</h2>
      <p>A new contact inquiry has been submitted:</p>
      
      <h3>Contact Information</h3>
      <ul>
        <li><strong>Name:</strong> ${leadData.full_name}</li>
        <li><strong>Email:</strong> ${leadData.email}</li>
        <li><strong>Phone:</strong> ${leadData.phone}</li>
        <li><strong>Company:</strong> ${leadData.company}</li>
      </ul>
      
      <h3>Message</h3>
      <p>${leadData.message}</p>
      
      <p><strong>Lead ID:</strong> ${savedLead.id}</p>
    `;

    // Send notification to sales team
    const { error: emailError } = await resend.emails.send({
      from: 'AI Platform <noreply@tulora.io>',
      to: ['sales@tulora.io'],
      subject: emailSubject,
      html: emailHtml,
      reply_to: leadData.email
    })

    if (emailError) {
      logStep('Email notification failed', savedLead.id)
      console.error('Failed to send notification email:', emailError)
    } else {
      logStep('Email notification sent', savedLead.id)
    }

    return new Response(JSON.stringify({ 
      success: true, 
      leadId: savedLead.id,
      inquiry_type: savedLead.inquiry_type,
      message: 'Submission received successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logStep('Unexpected error', undefined, 'error')
    console.error('Contact submission error:', errorMessage)
    
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Internal server error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})