import { serve } from "https://deno.land/std/http/server.ts";
import { Resend } from 'npm:resend@4.0.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { requireTurnstileIfPublic } from '../_shared/turnstile.ts'

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,authorization,x-client-info,apikey",
};

export const VERSION = "2025-09-09-6";

// Initialize Resend
const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

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
  turnstile_token?: string // Cloudflare Turnstile token
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

const logStep = (step: string, leadId?: string, status?: string, metadata?: any) => {
  // SECURITY: Only log IDs and status, no PII
  const details = leadId ? `leadId: ${leadId}` : '';
  const statusInfo = status ? `, status: ${status}` : '';
  
  // Redact any sensitive information from metadata
  const safeMetadata = metadata ? sanitizeLogMetadata(metadata) : '';
  
  console.log(`[CONTACT-SUBMIT] ${step}${details}${statusInfo}${safeMetadata ? `, meta: ${JSON.stringify(safeMetadata)}` : ''}`);
}

const sanitizeLogMetadata = (metadata: any): any => {
  if (!metadata || typeof metadata !== 'object') return {};
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(metadata)) {
    // Never log email, names, messages, or other PII
    if (['email', 'full_name', 'name', 'message', 'notes', 'additional_requirements', 'phone', 'company'].includes(key)) {
      continue;
    }
    
    // Redact tokens and secrets
    if (typeof value === 'string' && (value.includes('token') || value.includes('key') || value.includes('secret'))) {
      sanitized[key] = '[REDACTED]';
    } else if (key.toLowerCase().includes('token') || key.toLowerCase().includes('key') || key.toLowerCase().includes('secret')) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

const trimField = (value: any): string => {
  return typeof value === 'string' ? value.trim() : '';
}

const splitFullName = (fullName: string): { first_name: string; last_name: string } => {
  const trimmed = fullName.trim()
  const parts = trimmed.split(/\s+/)
  
  if (parts.length === 1) {
    return { first_name: '', last_name: parts[0] }
  } else {
    const firstName = parts[0]
    const lastName = parts.slice(1).join(' ')
    return { first_name: firstName, last_name: lastName }
  }
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

const checkRateLimit = async (clientIP: string): Promise<boolean> => {
  // Check if IP is rate limited (simple in-memory rate limiting)
  // In production, you'd use a proper rate limiting service
  const key = `rate_limit_${clientIP}`;
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const maxRequests = 5; // 5 requests per minute per IP
  
  // This is a simplified rate limiter - in production use Redis or similar
  if (!globalThis.rateLimitMap) {
    globalThis.rateLimitMap = new Map();
  }
  
  const requests = globalThis.rateLimitMap.get(key) || [];
  const recentRequests = requests.filter((time: number) => now - time < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false; // Rate limited
  }
  
  recentRequests.push(now);
  globalThis.rateLimitMap.set(key, recentRequests);
  
  return true; // Not rate limited
};

const checkHoneypot = (data: any): boolean => {
  // Check honeypot field - should be empty for legitimate submissions
  return !data.website;
};

serve(async (req) => {
  try {
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers: CORS });
    if (req.method !== "POST")
      return new Response(JSON.stringify({ ok: false, error: "Use POST" }),
        { status: 405, headers: { ...CORS, "Content-Type": "application/json" } });

    // Read/validate body (keep existing logic exactly)
    // Verify Turnstile for public browser requests first
    const turnstileResult = await requireTurnstileIfPublic(req);
    if (!turnstileResult.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Please complete the security verification to submit your request.",
        code: turnstileResult.code
      }), {
        status: 403,
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    const clientIP = req.headers.get('CF-Connecting-IP') || 
                     req.headers.get('X-Forwarded-For') || 
                     req.headers.get('X-Real-IP') || 
                     'unknown';
    
    logStep('Contact submission started', undefined, undefined, { ip: clientIP === 'unknown' ? 'unknown' : '[IP_REDACTED]' });

    // Rate limiting check
    const isAllowed = await checkRateLimit(clientIP);
    if (!isAllowed) {
      logStep('Rate limit exceeded', undefined, 'blocked', { ip: '[IP_REDACTED]' });
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Too many requests. Please wait before submitting again.',
        retry_after: 60
      }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
        status: 429,
      });
    }

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

    // Anti-spam: Check honeypot field
    if (!checkHoneypot(requestData)) {
      logStep('Honeypot triggered', undefined, 'blocked');
      // Silent fail for bot submissions - return success to avoid revealing the honeypot
      return new Response(JSON.stringify({ 
        ok: true,
        message: 'Thank you for your submission'
      }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // Validate payload
    const validationErrors = validatePayload(requestData)
    if (validationErrors.length > 0) {
      logStep('Validation failed', undefined, 'error')
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Validation failed',
        errors: validationErrors
      }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
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
        ok: false,
        error: 'Failed to save submission',
        details: leadError.message
      }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    logStep('Lead saved', savedLead.id, 'success')

    // Call CRM sync inline after DB insert and before email
    const traceId = crypto.randomUUID();
    let crm_ok = false, crm_status = 0, crm_error = null, crm_id = null;
    
    try {
      // Prepare lead payload for SuiteCRM
      const { first_name, last_name } = splitFullName(leadData.full_name)
      const leadPayload = {
        first_name,
        last_name,
        email1: leadData.email,
        phone_work: leadData.phone,
        account_name: leadData.company,
        lead_source: leadData.inquiry_type === 'contact' ? 'Website - Contact Us' : 'Website - Enterprise Sales',
        description: leadData.inquiry_type === 'contact' ? leadData.message : leadData.additional_requirements,
        product_line_c: leadData.product_line,
        product_interest_c: leadData.product_interest,
        inquiry_type_c: leadData.inquiry_type,
        expected_volume_c: leadData.expected_volume_label,
        expected_volume_code_c: leadData.expected_volume_value,
        utm_source_c: leadData.utm_source,
        utm_medium_c: leadData.utm_medium,
        utm_campaign_c: leadData.utm_campaign,
        utm_term_c: leadData.utm_term,
        utm_content_c: leadData.utm_content,
        page_url_c: leadData.page_url,
        referrer_c: leadData.referrer,
        ip_country_c: leadData.ip_country,
        marketing_opt_in_c: leadData.marketing_opt_in,
        external_id_c: savedLead.id,
        full_name: leadData.full_name
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const res = await fetch(`${supabaseUrl}/functions/v1/suitecrm-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadPayload)
      });
      
      crm_status = res.status;
      const j = await res.json().catch(() => ({}));
      crm_ok = !!j?.ok;
      crm_error = j?.error || null;
      crm_id = j?.result?.data?.id || j?.data?.id || null;
      
      logStep('CRM sync completed', savedLead.id, crm_ok ? 'success' : 'error')
    } catch (e) {
      crm_error = (e as Error).message || "network_error";
      logStep('CRM sync failed', savedLead.id, 'error')
    }

    console.info("lead.pipeline", { stage: "submit", crm_ok, status: crm_status });

    // Send notifications via email (no Slack integration)
    const resend = new Resend(resendKey)
    
    // Get configurable email addresses
    const salesInbox = Deno.env.get('SALES_INBOX') || 'sales@tulora.io'
    const helloInbox = Deno.env.get('HELLO_INBOX') || 'hello@tulora.io'
    const enterpriseInbox = Deno.env.get('ENTERPRISE_INBOX') || 'sales@tulora.io'
    const notificationsFrom = Deno.env.get('NOTIFICATIONS_FROM') || 'notifications@tulora.io'
    
    // Determine recipient based on inquiry type and product line
    let recipient = inquiryType === 'contact' ? helloInbox : enterpriseInbox
    const ccRecipients: string[] = []
    
    // CC sales for leadgen products
    if (leadData.product_line === 'leadgen' && recipient !== salesInbox) {
      ccRecipients.push(salesInbox)
    }
    
    // Subject pattern: [Tulora Lead] ${inquiry_type} • ${product_line} • ${company || '(no company)'}
    const companyText = leadData.company || '(no company)'
    const productLineText = leadData.product_line || inquiryType
    const emailSubject = `[Tulora Lead] ${inquiryType} • ${productLineText} • ${companyText}`

    const emailHtml = inquiryType === 'enterprise' ? `
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

    // Prepare confirmation email content
    const confirmationHtml = `
      <h2>Thank you for contacting Tulora</h2>
      <p>Hi ${leadData.full_name},</p>
      
      <p>Thank you for your interest in Tulora's AI solutions. We've received your ${inquiryType} inquiry and will respond within 24 hours.</p>
      
      <p>In the meantime, you can:</p>
      <ul>
        <li><a href="https://tulora.io/pricing">View our pricing</a></li>
        <li><a href="https://docs.tulora.io">Browse our documentation</a></li>
      </ul>
      
      <p>Best regards,<br>The Tulora Team</p>
    `

    // Initialize email message IDs array and delivery status
    const emailMessageIds: string[] = []
    let deliveryStatus = 'pending'

    // Send notification to sales team (don't block on failure)
    try {
      const emailOptions: any = {
        from: notificationsFrom,
        to: [recipient],
        subject: emailSubject,
        html: emailHtml,
        reply_to: leadData.email
      }
      
      if (ccRecipients.length > 0) {
        emailOptions.cc = ccRecipients
      }

      const { data: emailData, error: emailError } = await resend.emails.send(emailOptions)

      if (emailError) {
        logStep('Sales notification email failed', savedLead.id, 'error')
        console.error('Failed to send sales notification email:', emailError)
        deliveryStatus = 'failed'
      } else {
        logStep('Sales notification email sent', savedLead.id, 'success')
        if (emailData?.id) {
          emailMessageIds.push(emailData.id)
        }
      }
    } catch (error) {
      logStep('Sales notification email error', savedLead.id, 'error')
      console.error('Sales notification email error:', error)
      deliveryStatus = 'failed'
    }

    // Send confirmation email to prospect (don't block on failure)
    try {
      const { data: confirmationData, error: confirmationError } = await resend.emails.send({
        from: notificationsFrom,
        to: [leadData.email],
        subject: `Thank you for contacting Tulora`,
        html: confirmationHtml
      })

      if (confirmationError) {
        logStep('Confirmation email failed', savedLead.id, 'error')
        console.error('Failed to send confirmation email:', confirmationError)
        if (deliveryStatus !== 'failed') {
          deliveryStatus = 'partial'
        }
      } else {
        logStep('Confirmation email sent', savedLead.id, 'success')
        if (confirmationData?.id) {
          emailMessageIds.push(confirmationData.id)
        }
        if (deliveryStatus === 'pending') {
          deliveryStatus = 'sent'
        }
      }
    } catch (error) {
      logStep('Confirmation email error', savedLead.id, 'error')
      console.error('Confirmation email error:', error)
      if (deliveryStatus !== 'failed') {
        deliveryStatus = 'partial'
      }
    }

    // Update lead with delivery status and message IDs (don't fail if this fails)
    try {
      await supabase
        .from('leads')
        .update({
          delivery_status: deliveryStatus,
          email_message_ids: emailMessageIds
        })
        .eq('id', savedLead.id)
      
      logStep('Lead delivery status updated', savedLead.id, deliveryStatus)
    } catch (error) {
      logStep('Failed to update delivery status', savedLead.id, 'error')
      console.error('Failed to update lead delivery status:', error)
      // Don't fail the whole request if status update fails
    }

    // Prepare response with conditional admin debug info
    const isAdminRequest = req.headers.get("x-admin-request") === "1"
    const response: any = { 
      ok: true,
      version: VERSION,
      leadId: savedLead.id,
      inquiry_type: savedLead.inquiry_type,
      delivery_status: deliveryStatus,
      emails_sent: emailMessageIds.length,
      message: 'Submission received successfully'
    }

    // Add admin debug info if requested
    if (isAdminRequest) {
      response.crm_ok = crm_ok
      response.crm_status = crm_status
      response.crm_error = crm_error
      response.crm_id = crm_id
    }

    return new Response(JSON.stringify(response), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logStep('Unexpected error', undefined, 'error')
    console.error('Contact submission error:', errorMessage)
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: 'Internal server error',
      version: VERSION
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})