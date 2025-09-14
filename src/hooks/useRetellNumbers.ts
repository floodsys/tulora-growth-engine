import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

export interface RetellNumber {
  id: string
  organization_id: string
  number_id: string
  e164: string
  country: string
  sms_enabled: boolean
  is_active: boolean
  is_byoc: boolean
  byoc_provider?: string
  inbound_agent_id?: string
  outbound_agent_id?: string
  metadata?: any
  created_at: string
  updated_at: string
}

export interface AvailableNumber {
  id: string
  number: string
  country: string
  type: string
  usage?: {
    inbound?: boolean
    outbound?: boolean
  }
}

export interface BuyNumberParams {
  area_code?: string
  country?: string
}

export interface UpdateNumberParams {
  number_id: string
  inbound_agent_id?: string
  outbound_agent_id?: string
  sms_enabled?: boolean
}

export interface ImportNumberParams {
  e164: string
  country?: string
  byoc_provider: string
  sms_enabled?: boolean
}

export const useRetellNumbers = () => {
  const [loading, setLoading] = useState(false)
  const [ownedNumbers, setOwnedNumbers] = useState<RetellNumber[]>([])
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([])
  const { toast } = useToast()

  const listNumbers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('retell-numbers-list')
      
      if (error) {
        console.error('Error listing numbers:', error)
        toast({
          title: "Error",
          description: "Failed to load numbers",
          variant: "destructive",
        })
        return
      }

      setOwnedNumbers(data.owned_numbers || [])
      setAvailableNumbers(data.available_numbers || [])
    } catch (error) {
      console.error('Unexpected error:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const buyNumber = async (params: BuyNumberParams) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('retell-numbers-buy', {
        body: params
      })
      
      if (error) {
        console.error('Error buying number:', error)
        toast({
          title: "Error",
          description: "Failed to purchase number",
          variant: "destructive",
        })
        return null
      }

      toast({
        title: "Success",
        description: `Number ${data.number.e164} purchased successfully`,
      })
      
      // Refresh the list
      await listNumbers()
      return data.number
    } catch (error) {
      console.error('Unexpected error:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
      return null
    } finally {
      setLoading(false)
    }
  }

  const updateNumber = async (params: UpdateNumberParams) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('retell-numbers-update', {
        body: params
      })
      
      if (error) {
        console.error('Error updating number:', error)
        toast({
          title: "Error",
          description: "Failed to update number",
          variant: "destructive",
        })
        return null
      }

      toast({
        title: "Success",
        description: "Number updated successfully",
      })
      
      // Refresh the list
      await listNumbers()
      return data.number
    } catch (error) {
      console.error('Unexpected error:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
      return null
    } finally {
      setLoading(false)
    }
  }

  const releaseNumber = async (number_id: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('retell-numbers-release', {
        body: { number_id }
      })
      
      if (error) {
        console.error('Error releasing number:', error)
        toast({
          title: "Error",
          description: "Failed to release number",
          variant: "destructive",
        })
        return false
      }

      toast({
        title: "Success",
        description: "Number released successfully",
      })
      
      // Refresh the list
      await listNumbers()
      return true
    } catch (error) {
      console.error('Unexpected error:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  const importNumber = async (params: ImportNumberParams) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('retell-numbers-import', {
        body: params
      })
      
      if (error) {
        console.error('Error importing number:', error)
        toast({
          title: "Error",
          description: "Failed to import number",
          variant: "destructive",
        })
        return null
      }

      toast({
        title: "Success",
        description: `Number ${data.number.e164} imported successfully`,
      })
      
      // Refresh the list
      await listNumbers()
      return data.number
    } catch (error) {
      console.error('Unexpected error:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    ownedNumbers,
    availableNumbers,
    listNumbers,
    buyNumber,
    updateNumber,
    releaseNumber,
    importNumber,
  }
}