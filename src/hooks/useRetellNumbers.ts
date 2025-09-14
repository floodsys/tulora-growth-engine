import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface RetellNumber {
  id: string
  organization_id: string
  number_id: string
  e164: string
  country: string
  inbound_agent_id?: string
  outbound_agent_id?: string
  sms_enabled: boolean
  is_active: boolean
  is_byoc: boolean
  byoc_provider?: string
  metadata?: any
  created_at: string
  updated_at: string
}

export interface PurchaseNumberParams {
  country: string
  area_code?: string
}

export interface ImportNumberParams {
  e164: string
  provider: string
}

export const useRetellNumbers = (organizationId?: string) => {
  const [numbers, setNumbers] = useState<RetellNumber[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Load numbers
  const loadNumbers = async () => {
    if (!organizationId) return

    try {
      setLoading(true)
      // For now, return empty array since retell_numbers table doesn't exist yet
      setNumbers([])
    } catch (error) {
      console.error('Error loading numbers:', error)
      toast({
        title: "Error",
        description: "Failed to load phone numbers.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Purchase number
  const purchaseNumber = async (params: PurchaseNumberParams) => {
    if (!organizationId) return null

    try {
      const { data, error } = await supabase.functions.invoke('retell-numbers-purchase', {
        body: { organizationId, ...params }
      })

      if (error) throw error

      // Refresh numbers list
      await loadNumbers()

      return data
    } catch (error) {
      console.error('Error purchasing number:', error)
      throw error
    }
  }

  // Import BYOC number
  const importNumber = async (params: ImportNumberParams) => {
    if (!organizationId) return null

    try {
      const { data, error } = await supabase.functions.invoke('retell-numbers-import', {
        body: { organizationId, ...params }
      })

      if (error) throw error

      // Refresh numbers list
      await loadNumbers()

      return data
    } catch (error) {
      console.error('Error importing number:', error)
      throw error
    }
  }

  // Update number
  const updateNumber = async (numberId: string, updates: Partial<RetellNumber>) => {
    try {
      // Placeholder implementation
      setNumbers(prev => prev.map(number => 
        number.id === numberId ? { ...number, ...updates } : number
      ))

      return updates
    } catch (error) {
      console.error('Error updating number:', error)
      throw error
    }
  }

  // Delete number
  const deleteNumber = async (numberId: string) => {
    try {
      // Placeholder implementation
      setNumbers(prev => prev.filter(number => number.id !== numberId))
      
      toast({
        title: "Number deleted",
        description: "Phone number has been deleted successfully.",
      })
    } catch (error) {
      console.error('Error deleting number:', error)
      toast({
        title: "Error",
        description: "Failed to delete phone number.",
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    if (organizationId) {
      loadNumbers()
    }
  }, [organizationId])

  return {
    numbers,
    loading,
    loadNumbers,
    purchaseNumber,
    importNumber,
    updateNumber,
    deleteNumber,
  }
}