// SuiteCRM Lead mapping utilities
export interface LeadData {
  id: string
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
  page_url?: string
  referrer?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  ip_country?: string
  marketing_opt_in?: boolean
}

export interface SuiteCRMLeadPayload {
  // Standard SuiteCRM Lead fields
  first_name: string
  last_name: string
  email1: string
  phone_work?: string
  account_name?: string
  lead_source: string
  description: string
  
  // Custom fields (must end with _c)
  product_line_c?: string
  product_interest_c?: string
  inquiry_type_c: string
  expected_volume_c?: string
  expected_volume_code_c?: string
  utm_source_c?: string
  utm_medium_c?: string
  utm_campaign_c?: string
  utm_term_c?: string
  utm_content_c?: string
  page_url_c?: string
  referrer_c?: string
  ip_country_c?: string
  marketing_opt_in_c?: boolean
  external_id_c: string
}

export interface SuiteCRMCustomField {
  name: string
  label: string
  type: 'varchar' | 'text' | 'bool' | 'enum'
  options?: string[]
  required: boolean
  max_size?: number
}

/**
 * Split full name into first_name and last_name
 * Single token goes to last_name as per requirement
 */
export function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const trimmed = fullName.trim()
  const parts = trimmed.split(/\s+/)
  
  if (parts.length === 1) {
    // Single token → last_name
    return {
      first_name: '',
      last_name: parts[0]
    }
  } else {
    // Multiple tokens: first goes to first_name, rest to last_name
    const firstName = parts[0]
    const lastName = parts.slice(1).join(' ')
    return {
      first_name: firstName,
      last_name: lastName
    }
  }
}

/**
 * Compose description block from lead data
 */
export function composeDescription(lead: LeadData): string {
  const parts: string[] = []
  
  // Product interest and line
  if (lead.product_interest) {
    parts.push(`Product Interest: ${lead.product_interest}`)
  }
  if (lead.product_line) {
    parts.push(`Product Line: ${lead.product_line}`)
  }
  
  // Message or requirements
  const content = lead.inquiry_type === 'contact' ? lead.message : lead.additional_requirements
  if (content) {
    parts.push(`Details: ${content}`)
  }
  
  // Expected volume
  if (lead.expected_volume_label) {
    parts.push(`Expected Volume: ${lead.expected_volume_label}`)
  }
  
  // Tracking information
  const trackingParts: string[] = []
  if (lead.page_url) trackingParts.push(`Page: ${lead.page_url}`)
  if (lead.referrer) trackingParts.push(`Referrer: ${lead.referrer}`)
  if (lead.utm_source) trackingParts.push(`UTM Source: ${lead.utm_source}`)
  if (lead.utm_medium) trackingParts.push(`UTM Medium: ${lead.utm_medium}`)
  if (lead.utm_campaign) trackingParts.push(`UTM Campaign: ${lead.utm_campaign}`)
  if (lead.utm_term) trackingParts.push(`UTM Term: ${lead.utm_term}`)
  if (lead.utm_content) trackingParts.push(`UTM Content: ${lead.utm_content}`)
  
  if (trackingParts.length > 0) {
    parts.push(`Tracking: ${trackingParts.join(', ')}`)
  }
  
  return parts.join('\n\n')
}

/**
 * Map lead source based on inquiry type
 */
export function mapLeadSource(inquiryType: 'contact' | 'enterprise'): string {
  return inquiryType === 'contact' 
    ? 'Website - Contact Us'
    : 'Website - Enterprise Sales'
}

/**
 * Map our lead data to SuiteCRM Lead payload
 */
export function mapLeadToSuiteCRM(lead: LeadData): SuiteCRMLeadPayload {
  const { first_name, last_name } = splitFullName(lead.full_name)
  
  return {
    // Standard fields
    first_name,
    last_name,
    email1: lead.email,
    phone_work: lead.phone || undefined,
    account_name: lead.company || undefined,
    lead_source: mapLeadSource(lead.inquiry_type),
    description: composeDescription(lead),
    
    // Custom fields
    product_line_c: lead.product_line || undefined,
    product_interest_c: lead.product_interest || undefined,
    inquiry_type_c: lead.inquiry_type,
    expected_volume_c: lead.expected_volume_label || undefined,
    expected_volume_code_c: lead.expected_volume_value || undefined,
    utm_source_c: lead.utm_source || undefined,
    utm_medium_c: lead.utm_medium || undefined,
    utm_campaign_c: lead.utm_campaign || undefined,
    utm_term_c: lead.utm_term || undefined,
    utm_content_c: lead.utm_content || undefined,
    page_url_c: lead.page_url || undefined,
    referrer_c: lead.referrer || undefined,
    ip_country_c: lead.ip_country || undefined,
    marketing_opt_in_c: lead.marketing_opt_in || undefined,
    external_id_c: lead.id
  }
}

/**
 * Get required custom fields for SuiteCRM Leads module
 */
export function getRequiredCustomFields(): SuiteCRMCustomField[] {
  return [
    {
      name: 'product_line_c',
      label: 'Product Line',
      type: 'enum',
      options: ['leadgen', 'support'],
      required: false,
      max_size: 20
    },
    {
      name: 'product_interest_c',
      label: 'Product Interest',
      type: 'varchar',
      required: false,
      max_size: 100
    },
    {
      name: 'inquiry_type_c',
      label: 'Inquiry Type',
      type: 'enum',
      options: ['contact', 'enterprise'],
      required: true,
      max_size: 20
    },
    {
      name: 'expected_volume_c',
      label: 'Expected Volume',
      type: 'varchar',
      required: false,
      max_size: 50
    },
    {
      name: 'expected_volume_code_c',
      label: 'Expected Volume Code',
      type: 'enum',
      options: ['lt_5k', '5k_20k', '20k_100k', 'gt_100k', 'custom'],
      required: false,
      max_size: 20
    },
    {
      name: 'utm_source_c',
      label: 'UTM Source',
      type: 'varchar',
      required: false,
      max_size: 100
    },
    {
      name: 'utm_medium_c',
      label: 'UTM Medium',
      type: 'varchar',
      required: false,
      max_size: 100
    },
    {
      name: 'utm_campaign_c',
      label: 'UTM Campaign',
      type: 'varchar',
      required: false,
      max_size: 100
    },
    {
      name: 'utm_term_c',
      label: 'UTM Term',
      type: 'varchar',
      required: false,
      max_size: 100
    },
    {
      name: 'utm_content_c',
      label: 'UTM Content',
      type: 'varchar',
      required: false,
      max_size: 100
    },
    {
      name: 'page_url_c',
      label: 'Page URL',
      type: 'varchar',
      required: false,
      max_size: 255
    },
    {
      name: 'referrer_c',
      label: 'Referrer',
      type: 'varchar',
      required: false,
      max_size: 255
    },
    {
      name: 'ip_country_c',
      label: 'IP Country',
      type: 'varchar',
      required: false,
      max_size: 10
    },
    {
      name: 'marketing_opt_in_c',
      label: 'Marketing Opt In',
      type: 'bool',
      required: false
    },
    {
      name: 'external_id_c',
      label: 'External ID',
      type: 'varchar',
      required: true,
      max_size: 36
    }
  ]
}

/**
 * Preview the SuiteCRM payload for debugging
 */
export function previewSuiteCRMPayload(lead: LeadData): {
  payload: SuiteCRMLeadPayload
  summary: string
  fieldCount: { standard: number; custom: number }
} {
  const payload = mapLeadToSuiteCRM(lead)
  
  // Count fields
  const standardFields = ['first_name', 'last_name', 'email1', 'phone_work', 'account_name', 'lead_source', 'description']
  const customFields = Object.keys(payload).filter(key => key.endsWith('_c'))
  
  const standardCount = standardFields.filter(field => payload[field as keyof SuiteCRMLeadPayload]).length
  const customCount = customFields.filter(field => payload[field as keyof SuiteCRMLeadPayload] !== undefined).length
  
  const summary = `
SuiteCRM Lead Mapping Preview:
- Name: ${payload.first_name} ${payload.last_name}
- Email: ${payload.email1}
- Company: ${payload.account_name || 'N/A'}
- Source: ${payload.lead_source}
- Inquiry Type: ${payload.inquiry_type_c}
- Product Line: ${payload.product_line_c || 'N/A'}
- External ID: ${payload.external_id_c}
- Fields: ${standardCount} standard, ${customCount} custom
  `.trim()
  
  return {
    payload,
    summary,
    fieldCount: {
      standard: standardCount,
      custom: customCount
    }
  }
}