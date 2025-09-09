// Canonical payload builder for contact forms
// Ensures consistent payload format across all contact submission points

export interface ContactPayloadData {
  inquiry_type: 'contact' | 'enterprise';
  full_name: string;
  email: string;
  message: string;
  company?: string;
  phone?: string;
  website?: string;
  leads_id?: string;
  source?: string;
  source_metadata?: Record<string, any>;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

export interface RawFormData {
  fullName?: string;
  name?: string; // legacy
  email: string;
  phone?: string;
  company?: string;
  project?: string; // Talk-to-Us form
  message?: string;
  notes?: string; // Enterprise form
  website?: string; // honeypot
  [key: string]: any; // Allow other fields to be filtered out
}

/**
 * Creates a canonical payload for contact/sales submissions
 * Only includes allowed fields with proper snake_case naming
 */
export function buildContactPayload(
  inquiryType: 'contact' | 'enterprise',
  formData: RawFormData,
  options?: {
    source?: string;
    source_metadata?: Record<string, any>;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
    leads_id?: string;
  }
): ContactPayloadData {
  // Build the canonical payload with only allowed fields
  const payload: ContactPayloadData = {
    inquiry_type: inquiryType,
    full_name: (formData.fullName || formData.name || '').trim(),
    email: formData.email.trim(),
    message: (formData.project || formData.message || formData.notes || '').trim()
  };

  // Add optional fields only if they have values
  if (formData.company?.trim()) {
    payload.company = formData.company.trim();
  }

  if (formData.phone?.trim()) {
    payload.phone = formData.phone.trim();
  }

  if (formData.website?.trim()) {
    payload.website = formData.website.trim();
  }

  // Add options if provided
  if (options?.source?.trim()) {
    payload.source = options.source.trim();
  }

  if (options?.source_metadata && Object.keys(options.source_metadata).length > 0) {
    payload.source_metadata = options.source_metadata;
  }

  if (options?.utm_source?.trim()) {
    payload.utm_source = options.utm_source.trim();
  }

  if (options?.utm_medium?.trim()) {
    payload.utm_medium = options.utm_medium.trim();
  }

  if (options?.utm_campaign?.trim()) {
    payload.utm_campaign = options.utm_campaign.trim();
  }

  if (options?.utm_term?.trim()) {
    payload.utm_term = options.utm_term.trim();
  }

  if (options?.utm_content?.trim()) {
    payload.utm_content = options.utm_content.trim();
  }

  if (options?.leads_id?.trim()) {
    payload.leads_id = options.leads_id.trim();
  }

  return payload;
}

/**
 * Validates that a payload contains required fields
 */
export function validateContactPayload(payload: ContactPayloadData): string[] {
  const errors: string[] = [];

  if (!payload.inquiry_type || !['contact', 'enterprise'].includes(payload.inquiry_type)) {
    errors.push('inquiry_type must be contact or enterprise');
  }

  if (!payload.full_name?.trim()) {
    errors.push('full_name is required');
  }

  if (!payload.email?.trim()) {
    errors.push('email is required');
  }

  if (!payload.message?.trim()) {
    errors.push('message is required');
  }

  return errors;
}