import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface SMSBrand {
  id: string
  organization_id: string
  brand_name: string
  company_name: string
  tax_id?: string
  website?: string
  industry?: string
  phone_number?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  postal_code?: string
  country: string
  registration_status: string
  brand_id?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
}

export interface SMSCampaign {
  id: string
  organization_id: string
  brand_id: string
  campaign_name: string
  campaign_type: string
  use_case: string
  sample_messages: string[]
  monthly_volume: number
  registration_status: string
  campaign_id?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
}

export interface SMSMessage {
  id: string
  organization_id: string
  campaign_id?: string
  number_id?: string
  direction: 'inbound' | 'outbound'
  from_number: string
  to_number: string
  message_body: string
  delivery_status: string
  delivery_timestamp?: string
  error_code?: string
  error_message?: string
  provider_message_id?: string
  cost_cents: number
  created_at: string
}

export interface BrandRegistrationParams {
  brand_name: string
  company_name: string
  tax_id?: string
  website?: string
  industry?: string
  phone_number?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

export interface CampaignRegistrationParams {
  brand_id: string
  campaign_name: string
  campaign_type?: string
  use_case: string
  sample_messages: string[]
  monthly_volume?: number
}

export interface SendSMSParams {
  to_number: string
  message_body: string
  campaign_id?: string
  number_id?: string
}

export function useSMS() {
  const [loading, setLoading] = useState(false)
  const [brands, setBrands] = useState<SMSBrand[]>([])
  const [campaigns, setCampaigns] = useState<SMSCampaign[]>([])
  const [messages, setMessages] = useState<SMSMessage[]>([])

  const listBrands = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('sms_brands')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setBrands(data || [])
    } catch (error) {
      console.error('Error fetching SMS brands:', error)
      toast.error('Failed to fetch SMS brands')
    } finally {
      setLoading(false)
    }
  }

  const listCampaigns = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('sms_campaigns')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCampaigns(data || [])
    } catch (error) {
      console.error('Error fetching SMS campaigns:', error)
      toast.error('Failed to fetch SMS campaigns')
    } finally {
      setLoading(false)
    }
  }

  const listMessages = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('sms_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setMessages((data || []) as SMSMessage[])
    } catch (error) {
      console.error('Error fetching SMS messages:', error)
      toast.error('Failed to fetch SMS messages')
    } finally {
      setLoading(false)
    }
  }

  const registerBrand = async (params: BrandRegistrationParams) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.functions.invoke('sms-brand-register', {
        body: params,
      })

      if (error) throw error

      toast.success('Brand registration submitted successfully')
      await listBrands() // Refresh the list
      return data.brand
    } catch (error) {
      console.error('Error registering brand:', error)
      toast.error('Failed to register brand')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const registerCampaign = async (params: CampaignRegistrationParams) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.functions.invoke('sms-campaign-register', {
        body: params,
      })

      if (error) throw error

      toast.success('Campaign registration submitted successfully')
      await listCampaigns() // Refresh the list
      return data.campaign
    } catch (error) {
      console.error('Error registering campaign:', error)
      toast.error('Failed to register campaign')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const sendSMS = async (params: SendSMSParams) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.functions.invoke('sms-send', {
        body: params,
      })

      if (error) throw error

      toast.success('SMS sent successfully')
      await listMessages() // Refresh the list
      return data
    } catch (error) {
      console.error('Error sending SMS:', error)
      toast.error('Failed to send SMS')
      throw error
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    brands,
    campaigns,
    messages,
    listBrands,
    listCampaigns,
    listMessages,
    registerBrand,
    registerCampaign,
    sendSMS,
  }
}