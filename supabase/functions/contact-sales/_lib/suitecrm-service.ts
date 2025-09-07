// SuiteCRM API service for lead management
import { 
  LeadData, 
  SuiteCRMLeadPayload, 
  SuiteCRMCustomField, 
  mapLeadToSuiteCRM, 
  getRequiredCustomFields,
  previewSuiteCRMPayload 
} from './suitecrm-mapping.ts'

export interface SuiteCRMConfig {
  baseUrl: string
  username: string
  password: string
  clientId?: string
  clientSecret?: string
}

export interface SuiteCRMAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
}

export interface SuiteCRMFieldResponse {
  name: string
  label: string
  type: string
  required: boolean
  options?: { [key: string]: string }
}

export interface SuiteCRMSyncResult {
  success: boolean
  leadId?: string
  message: string
  payload?: SuiteCRMLeadPayload
  errors?: string[]
  fieldsMissing?: string[]
  fieldsCreated?: string[]
}

export class SuiteCRMService {
  private config: SuiteCRMConfig
  private accessToken?: string
  private tokenExpiry?: Date

  constructor(config: SuiteCRMConfig) {
    this.config = config
  }

  /**
   * Authenticate with SuiteCRM OAuth2
   */
  async authenticate(): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/Api/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'password',
          client_id: this.config.clientId || 'suitecrm_client',
          client_secret: this.config.clientSecret || '',
          username: this.config.username,
          password: this.config.password,
          scope: 'openid profile email'
        })
      })

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`)
      }

      const authData: SuiteCRMAuthResponse = await response.json()
      this.accessToken = authData.access_token
      
      // Set expiry time (subtract 5 minutes for safety)
      const expirySeconds = authData.expires_in - 300
      this.tokenExpiry = new Date(Date.now() + (expirySeconds * 1000))
      
    } catch (error) {
      throw new Error(`SuiteCRM authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiry || this.tokenExpiry <= new Date()) {
      await this.authenticate()
    }
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    await this.ensureAuthenticated()
    
    const url = `${this.config.baseUrl}/Api/V8${endpoint}`
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`SuiteCRM API request failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return response
  }

  /**
   * Get existing custom fields for Leads module
   */
  async getLeadsModuleFields(): Promise<SuiteCRMFieldResponse[]> {
    try {
      const response = await this.apiRequest('/module/Leads/meta/fields')
      const data = await response.json()
      return data.data || []
    } catch (error) {
      console.error('Failed to get Leads module fields:', error)
      return []
    }
  }

  /**
   * Create a custom field in SuiteCRM
   */
  async createCustomField(field: SuiteCRMCustomField): Promise<boolean> {
    try {
      const fieldDefinition = {
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.required,
        module: 'Leads'
      }

      // Add type-specific properties
      if (field.type === 'varchar' && field.max_size) {
        fieldDefinition['max_size'] = field.max_size
      }
      
      if (field.type === 'enum' && field.options) {
        fieldDefinition['options'] = field.options.reduce((acc, option, index) => {
          acc[option] = option
          return acc
        }, {} as { [key: string]: string })
      }

      const response = await this.apiRequest('/module/Leads/meta/fields', {
        method: 'POST',
        body: JSON.stringify({ data: fieldDefinition })
      })

      return response.ok
    } catch (error) {
      console.error(`Failed to create custom field ${field.name}:`, error)
      return false
    }
  }

  /**
   * Ensure all required custom fields exist
   */
  async ensureCustomFields(): Promise<{ missing: string[], created: string[], errors: string[] }> {
    const requiredFields = getRequiredCustomFields()
    const existingFields = await this.getLeadsModuleFields()
    const existingFieldNames = existingFields.map(f => f.name)
    
    const missing: string[] = []
    const created: string[] = []
    const errors: string[] = []
    
    for (const field of requiredFields) {
      if (!existingFieldNames.includes(field.name)) {
        missing.push(field.name)
        
        try {
          const success = await this.createCustomField(field)
          if (success) {
            created.push(field.name)
          } else {
            errors.push(`Failed to create field: ${field.name}`)
          }
        } catch (error) {
          errors.push(`Error creating field ${field.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }
    
    return { missing, created, errors }
  }

  /**
   * Check if lead exists by external_id_c (for idempotency)
   */
  async findLeadByExternalId(externalId: string): Promise<string | null> {
    try {
      const response = await this.apiRequest(`/module/Leads?filter[external_id_c]=${encodeURIComponent(externalId)}`)
      const data = await response.json()
      
      if (data.data && data.data.length > 0) {
        return data.data[0].id
      }
      
      return null
    } catch (error) {
      console.error('Failed to find lead by external ID:', error)
      return null
    }
  }

  /**
   * Create or update lead in SuiteCRM
   */
  async upsertLead(payload: SuiteCRMLeadPayload): Promise<{ success: boolean, leadId?: string, message: string }> {
    try {
      // Check if lead already exists
      const existingLeadId = await this.findLeadByExternalId(payload.external_id_c)
      
      if (existingLeadId) {
        // Update existing lead
        const response = await this.apiRequest(`/module/Leads/${existingLeadId}`, {
          method: 'PATCH',
          body: JSON.stringify({ data: { attributes: payload } })
        })
        
        return {
          success: true,
          leadId: existingLeadId,
          message: `Lead updated successfully (ID: ${existingLeadId})`
        }
      } else {
        // Create new lead
        const response = await this.apiRequest('/module/Leads', {
          method: 'POST',
          body: JSON.stringify({ data: { type: 'Leads', attributes: payload } })
        })
        
        const data = await response.json()
        const newLeadId = data.data?.id
        
        return {
          success: true,
          leadId: newLeadId,
          message: `Lead created successfully (ID: ${newLeadId})`
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to sync lead: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Full sync process: ensure fields, map data, and sync lead
   */
  async syncLead(lead: LeadData): Promise<SuiteCRMSyncResult> {
    try {
      // 1. Ensure custom fields exist
      const fieldStatus = await this.ensureCustomFields()
      
      // 2. Map lead data to SuiteCRM format
      const payload = mapLeadToSuiteCRM(lead)
      
      // 3. Preview for debugging
      const preview = previewSuiteCRMPayload(lead)
      console.log('SuiteCRM Lead Preview:', preview.summary)
      
      // 4. Sync to SuiteCRM
      const syncResult = await this.upsertLead(payload)
      
      return {
        success: syncResult.success,
        leadId: syncResult.leadId,
        message: syncResult.message,
        payload: payload,
        fieldsMissing: fieldStatus.missing,
        fieldsCreated: fieldStatus.created,
        errors: fieldStatus.errors.length > 0 ? fieldStatus.errors : undefined
      }
      
    } catch (error) {
      return {
        success: false,
        message: `SuiteCRM sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }
}

/**
 * Create SuiteCRM service instance from environment variables
 */
export function createSuiteCRMService(): SuiteCRMService | null {
  const baseUrl = Deno.env.get('SUITECRM_BASE_URL')
  const username = Deno.env.get('SUITECRM_USERNAME')
  const password = Deno.env.get('SUITECRM_PASSWORD')
  
  if (!baseUrl || !username || !password) {
    console.log('SuiteCRM credentials not configured, skipping CRM sync')
    return null
  }
  
  return new SuiteCRMService({
    baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
    username,
    password,
    clientId: Deno.env.get('SUITECRM_CLIENT_ID'),
    clientSecret: Deno.env.get('SUITECRM_CLIENT_SECRET')
  })
}