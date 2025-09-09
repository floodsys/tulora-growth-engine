import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import React from 'npm:react@18.3.1'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { createSuiteCRMService } from './_lib/suitecrm-service.ts'
import { previewSuiteCRMPayload } from './_lib/suitecrm-mapping.ts'
import { ContactConfirmationEmail } from './_templates/contact-confirmation.tsx'
import { EnterpriseConfirmationEmail } from './_templates/enterprise-confirmation.tsx'

// Version and function info
const VERSION = "2025-09-09-8";
const FUNCTION_NAME = "contact-sales";

// CORS Configuration
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(o => o.trim()) || [
  'https://lovable.dev',
  'https://preview--tulora-growth-engine.lovable.app',
  'https://tulora-growth-engine.lovable.app',
  'https://82f60040-b989-4e09-8aaf-a5888522b1a2.lovableproject.com',
  'https://id-preview--82f60040-b989-4e09-8aaf-a5888522b1a2.lovable.app',
  'http://localhost:8080'
];
const CORS_DEBUG_WILDCARD = Deno.env.get('CORS_DEBUG_WILDCARD') === 'true';

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
    'Access-Control-Expose-Headers': 'X-Function, X-Version, X-CRM-Status'
  };

  // Force wildcard if debug mode is enabled
  if (CORS_DEBUG_WILDCARD) {
    headers['Access-Control-Allow-Origin'] = '*';
    return headers;
  }

  // Check if origin is in allowed list
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

// Initialize Resend
const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

// Helper function to create response with consistent headers
const createResponse = (data: any, status = 200, requestOrigin: string | null = null, crmStatus?: string) => {
  const headers = { 
    ...getCorsHeaders(requestOrigin), 
    'Content-Type': 'application/json',
    'X-Function': FUNCTION_NAME,
    'X-Version': VERSION
  };
  
  if (crmStatus) {
    headers['X-CRM-Status'] = crmStatus;
  }
  
  // Add function and version info to response data
  const responseData = {
    ...data,
    function: FUNCTION_NAME,
    version: VERSION,
    method_used: 'POST'
  };
  
  return new Response(JSON.stringify(responseData), {
    status,
    headers
  });
};

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

// Environment configuration
const FORMS_NORMALIZE_KEYS = Deno.env.get('FORMS_NORMALIZE_KEYS') === 'true';
const REQUIRE_ENTERPRISE_COMPANY = Deno.env.get('REQUIRE_ENTERPRISE_COMPANY') === 'true';
const REQUIRE_ENTERPRISE_EXTRAS = Deno.env.get('REQUIRE_ENTERPRISE_EXTRAS') === 'true';

console.log('[CONFIG] Environment flags loaded:');
console.log(`  VERSION: ${VERSION}`);
console.log(`  FUNCTION_NAME: ${FUNCTION_NAME}`);
console.log(`  REQUIRE_ENTERPRISE_COMPANY: ${REQUIRE_ENTERPRISE_COMPANY}`);
console.log(`  REQUIRE_ENTERPRISE_EXTRAS: ${REQUIRE_ENTERPRISE_EXTRAS}`);
console.log(`  FORMS_NORMALIZE_KEYS: ${FORMS_NORMALIZE_KEYS}`);
console.log(`  CORS_DEBUG_WILDCARD: ${CORS_DEBUG_WILDCARD}`);
console.log(`  ALLOWED_ORIGINS: ${ALLOWED_ORIGINS.join(', ')}`);

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

const verifyTurnstileToken = async (token: string, remoteIP?: string): Promise<boolean> => {
  const secretKey = Deno.env.get('CLOUDFLARE_TURNSTILE_SECRET_KEY');
  
  if (!secretKey) {
    console.warn('Turnstile secret key not configured');
    return false;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        ...(remoteIP && { remoteip: remoteIP })
      }),
    });

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
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

  // Validate based on inquiry type - aligned with Valid Payload Examples
  if (inquiryType === 'contact') {
    // Required: inquiry_type, full_name, email, message
    if (!message) {
      errors.push({ field: 'message', message: 'Message is required for contact inquiries' });
    }
  } else if (inquiryType === 'enterprise') {
    // Required: inquiry_type, full_name, email, message (keep company + extras optional)
    if (!message) {
      errors.push({ field: 'message', message: 'Message is required for enterprise inquiries' });
    }
    
    // Company field - only required if REQUIRE_ENTERPRISE_COMPANY=true (default false)
    if (REQUIRE_ENTERPRISE_COMPANY && !company) {
      errors.push({ field: 'company', message: 'Company name is required for enterprise inquiries' });
    }
    
    // Optional enterprise fields - only required if REQUIRE_ENTERPRISE_EXTRAS=true (default false)
    if (REQUIRE_ENTERPRISE_EXTRAS) {
      if (!productInterest) {
        errors.push({ field: 'product_interest', message: 'Product interest is required for enterprise inquiries' });
      }
      if (!expectedVolumeLabel) {
        errors.push({ field: 'expected_volume', message: 'Expected volume is required for enterprise inquiries' });
      }
      if (!additionalRequirements) {
        errors.push({ field: 'additional_requirements', message: 'Additional requirements are required for enterprise inquiries' });
      }
    }

    // Validate product interest enum (if provided)
    if (productInterest && !['AI Lead Generation', 'AI Customer Service', 'leadgen', 'support'].includes(productInterest)) {
      errors.push({ field: 'product_interest', message: 'Product interest must be either "AI Lead Generation" or "AI Customer Service"' });
    }

    // Validate expected volume enum (if provided)
    const validVolumes = ['< 5,000 calls/month', '5,000-20,000 calls/month', '20,000-100,000 calls/month', '> 100,000 calls/month', 'Custom/Variable'];
    if (expectedVolumeLabel && !validVolumes.includes(expectedVolumeLabel)) {
      errors.push({ field: 'expected_volume', message: 'Expected volume must be one of the valid options' });
    }
  }
  
  return errors;
}

const extractTrackingData = (req: Request): Partial<LeadData> => {
  const trackingData: Partial<LeadData> = {};
  
  // Parse UTM parameters from URL if present
  const url = new URL(req.url);
  trackingData.utm_source = url.searchParams.get('utm_source') || undefined;
  trackingData.utm_medium = url.searchParams.get('utm_medium') || undefined;
  trackingData.utm_campaign = url.searchParams.get('utm_campaign') || undefined;
  trackingData.utm_term = url.searchParams.get('utm_term') || undefined;
  trackingData.utm_content = url.searchParams.get('utm_content') || undefined;
  
  // Extract referrer
  trackingData.referrer = req.headers.get('referer') || undefined;
  
  // Extract page URL (from referrer or construct from host)
  trackingData.page_url = trackingData.referrer || `${url.protocol}//${url.host}`;
  
  return trackingData;
}

// Rate limiting map (in-memory, resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const checkRateLimit = (ip: string): boolean => {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10; // Max 10 requests per minute per IP
  
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    // Reset or create new record
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= maxRequests) {
    return false; // Rate limit exceeded
  }
  
  record.count++;
  return true;
}

const checkHoneypot = (data: any): boolean => {
  // Check for honeypot field 'website' - should be empty for humans
  return !data.website || data.website.trim() === '';
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  if (req.method !== 'POST') {
    const responseData = { 
      success: false, 
      error: 'Method not allowed',
      function: FUNCTION_NAME,
      version: VERSION,
      method_used: req.method
    };
    
    return new Response(JSON.stringify(responseData), { 
      status: 405, 
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Function': FUNCTION_NAME,
        'X-Version': VERSION
      }
    });
  }

  // Get client IP for rate limiting
  const clientIP = req.headers.get('cf-connecting-ip') || 
                   req.headers.get('x-forwarded-for') || 
                   req.headers.get('x-real-ip') || 
                   'unknown';

  // Rate limiting
  if (!checkRateLimit(clientIP)) {
    logStep('rate_limit_exceeded', undefined, 'blocked', { ip: clientIP });
    return createResponse({
      success: false,
      error: 'Too many requests. Please try again later.',
      error_code: 'rate_limit_exceeded'
    }, 429, origin);
  }

  logStep('request_start', undefined, 'processing');

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    let data: ContactFormRequest;
    try {
      data = await req.json();
    } catch (error) {
      logStep('parse_error', undefined, 'failed', { error: error.message });
      return createResponse({
        success: false,
        error: 'Invalid JSON payload',
        details: error.message
      }, 400, origin);
    }

    logStep('payload_received', undefined, 'parsed', { 
      inquiry_type: data.inquiry_type,
      has_email: !!data.email,
      has_name: !!(data.full_name || data.name)
    });

    // Check honeypot
    if (!checkHoneypot(data)) {
      logStep('honeypot_triggered', undefined, 'blocked');
      return createResponse({
        success: false,
        error: 'Spam detected'
      }, 400, origin);
    }

    // Validate payload
    const validationErrors = validatePayload(data);
    if (validationErrors.length > 0) {
      logStep('validation_failed', undefined, 'failed', { 
        error_count: validationErrors.length,
        error_fields: validationErrors.map(e => e.field)
      });
      return createResponse({
        success: false,
        error: 'Validation failed',
        details: validationErrors,
        error_code: 'validation_error'
      }, 422, origin);
    }

    // Extract tracking data
    const trackingData = extractTrackingData(req);

    // Normalize and prepare lead data
    const leadData: LeadData = {
      inquiry_type: data.inquiry_type,
      full_name: normalizeFullName(data.full_name || data.name || ''),
      email: data.email.toLowerCase().trim(),
      phone: data.phone?.trim() || undefined,
      company: data.company?.trim() || undefined,
      message: data.message?.trim() || undefined,
      product_interest: data.product_interest?.trim() || undefined,
      product_line: data.product_interest ? mapProductInterestToLine(data.product_interest) : undefined,
      additional_requirements: (data.additional_requirements || data.notes)?.trim() || undefined,
      expected_volume_label: (data.expected_volume_label || data.expected_volume)?.trim() || undefined,
      expected_volume_value: data.expected_volume ? mapVolumeToCode(data.expected_volume) : undefined,
      accept_privacy: data.accept_privacy ?? true,
      marketing_opt_in: data.marketing_opt_in ?? false,
      ...trackingData,
      ip_country: req.headers.get('cf-ipcountry') || undefined
    };

    logStep('lead_data_prepared', undefined, 'ready', { 
      inquiry_type: leadData.inquiry_type,
      has_tracking: !!(leadData.utm_source || leadData.referrer)
    });

    // Authenticate user if Authorization header is provided
    let organizationId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (user && !error) {
          // Get user's organization
          const { data: orgData } = await supabase
            .from('organizations')
            .select('id')
            .eq('owner_user_id', user.id)
            .single();
          
          if (orgData) {
            organizationId = orgData.id;
            logStep('user_authenticated', undefined, 'success', { org_id: organizationId });
          }
        }
      } catch (authError) {
        console.warn('Auth header provided but user authentication failed:', authError);
      }
    }

    // Insert lead into database
    const { data: leadRecord, error: insertError } = await supabase
      .from('leads')
      .insert({
        ...leadData,
        organization_id: organizationId,
        crm_sync_status: organizationId ? 'pending' : 'not_applicable', // Only sync if org context
        email_status: 'pending'
      })
      .select()
      .single();

    if (insertError || !leadRecord) {
      logStep('db_insert_failed', undefined, 'failed', { error: insertError?.message });
      return createResponse({
        success: false,
        error: 'Failed to save lead data',
        details: insertError?.message,
        error_code: 'database_error'
      }, 500, origin);
    }

    logStep('lead_inserted', leadRecord.id, 'success');

    // CRM Sync (only if organization context exists)
    let syncResult = null;
    if (organizationId) {
      try {
        const crmService = createSuiteCRMService();
        syncResult = await crmService.syncLead(leadRecord);
        
        if (syncResult.success) {
          logStep('crm_sync_success', leadRecord.id, 'synced', { crm_id: syncResult.crm_id });
        } else {
          logStep('crm_sync_failed', leadRecord.id, 'failed', { error: syncResult.error });
        }
      } catch (crmError) {
        logStep('crm_sync_error', leadRecord.id, 'error', { error: crmError.message });
        syncResult = { success: false, error: crmError.message };
      }

      // Update lead with CRM sync status
      await supabase
        .from('leads')
        .update({
          crm_sync_status: syncResult.success ? 'completed' : 'failed',
          crm_sync_error: syncResult.success ? null : syncResult.error,
          crm_id: syncResult.success ? syncResult.crm_id : null
        })
        .eq('id', leadRecord.id);
    }

    // Send notification emails
    let salesEmailResult = null;
    let confirmationEmailResult = null;

    try {
      // Send sales notification email
      const salesEmail = await resend.emails.send({
        from: 'Tulora Forms <forms@tulora.io>',
        to: ['sales@tulora.io'],
        subject: `New ${leadData.inquiry_type} inquiry from ${leadData.full_name}`,
        html: `
          <h2>New ${leadData.inquiry_type} inquiry</h2>
          <p><strong>Name:</strong> ${leadData.full_name}</p>
          <p><strong>Email:</strong> ${leadData.email}</p>
          ${leadData.phone ? `<p><strong>Phone:</strong> ${leadData.phone}</p>` : ''}
          ${leadData.company ? `<p><strong>Company:</strong> ${leadData.company}</p>` : ''}
          ${leadData.product_interest ? `<p><strong>Product Interest:</strong> ${leadData.product_interest}</p>` : ''}
          ${leadData.expected_volume_label ? `<p><strong>Expected Volume:</strong> ${leadData.expected_volume_label}</p>` : ''}
          <p><strong>Message:</strong></p>
          <p>${(leadData.message || '').replace(/\n/g, '<br>')}</p>
          ${leadData.additional_requirements ? `<p><strong>Additional Requirements:</strong></p><p>${leadData.additional_requirements.replace(/\n/g, '<br>')}</p>` : ''}
          <hr>
          <p><strong>Lead ID:</strong> ${leadRecord.id}</p>
          ${syncResult ? `<p><strong>CRM Sync:</strong> ${syncResult.success ? 'Success' : `Failed: ${syncResult.error}`}</p>` : ''}
        `
      });

      salesEmailResult = { success: !salesEmail.error, id: salesEmail.data?.id, error: salesEmail.error };
      logStep('sales_email_sent', leadRecord.id, salesEmailResult.success ? 'sent' : 'failed');

      // Send confirmation email to prospect
      const isEnterprise = leadData.inquiry_type === 'enterprise';
      const confirmationTemplate = isEnterprise ? EnterpriseConfirmationEmail : ContactConfirmationEmail;
      
      const confirmationHtml = await renderAsync(
        React.createElement(confirmationTemplate, {
          leadData,
          leadId: leadRecord.id
        })
      );

      const confirmationEmail = await resend.emails.send({
        from: 'Tulora Team <hello@tulora.io>',
        to: [leadData.email],
        subject: isEnterprise 
          ? 'Thank you for your enterprise inquiry - Tulora' 
          : 'Thank you for contacting us - Tulora',
        html: confirmationHtml
      });

      confirmationEmailResult = { 
        success: !confirmationEmail.error, 
        id: confirmationEmail.data?.id, 
        error: confirmationEmail.error 
      };
      logStep('confirmation_email_sent', leadRecord.id, confirmationEmailResult.success ? 'sent' : 'failed');

    } catch (emailError) {
      logStep('email_error', leadRecord.id, 'failed', { error: emailError.message });
      salesEmailResult = { success: false, error: emailError.message };
      confirmationEmailResult = { success: false, error: emailError.message };
    }

    // Update lead with email delivery status
    await supabase
      .from('leads')
      .update({
        email_status: (salesEmailResult?.success && confirmationEmailResult?.success) ? 'sent' : 'failed',
        email_error: (!salesEmailResult?.success || !confirmationEmailResult?.success) 
          ? `Sales: ${salesEmailResult?.error || 'OK'}, Confirmation: ${confirmationEmailResult?.error || 'OK'}`
          : null
      })
      .eq('id', leadRecord.id);

    // Check if CRM sync failed and return appropriate status
    if (syncResult && !syncResult.success) {
      logStep('response_crm_failure', leadRecord.id, 'failed');
      return createResponse({
        success: false,
        error: 'CRM synchronization failed',
        details: syncResult.error,
        error_code: 'crm_sync_failed',
        lead_id: leadRecord.id
      }, 424, origin, 'failed');
    }

    // Success response
    const successResponse = {
      success: true,
      message: 'Lead submitted successfully',
      lead_id: leadRecord.id,
      crm_sync: syncResult,
      email_delivery: {
        sales_notification: salesEmailResult,
        confirmation: confirmationEmailResult
      }
    };

    logStep('response_success', leadRecord.id, 'completed', { 
      crm_synced: syncResult?.success || false,
      emails_sent: {
        sales: salesEmailResult?.success || false,
        confirmation: confirmationEmailResult?.success || false
      }
    });

    return createResponse(successResponse, 200, origin, syncResult?.success ? 'success' : 'not_applicable');

  } catch (error) {
    console.error('[ERROR] Contact sales submission failed:', error);
    
    const errorResponse = {
      success: false,
      error: error.message || 'Internal server error',
      details: error instanceof Error ? error.stack : String(error)
    };

    return createResponse(errorResponse, 500, origin, 'error');
  }
});
