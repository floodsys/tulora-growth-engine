import { useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface WebCallSession {
  call_id: string
  access_token: string
  client_secret?: string
}

export interface BillingLimitState {
  isOverLimit: boolean
  message?: string
}

export const useRetellWebCall = () => {
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<WebCallSession | null>(null)
  const [billingLimitError, setBillingLimitError] = useState<BillingLimitState>({ isOverLimit: false })
  const [buttonDisabledUntil, setButtonDisabledUntil] = useState<number>(0)
  const { toast } = useToast()

  // Check if error response indicates billing over limit
  const isBillingOverLimit = (data: any): boolean => {
    return data?.code === 'BILLING_OVER_LIMIT'
  }

  // Check if error is a BILLING_QUOTA_CHECK_ERROR (transient usage verification failure)
  const isBillingQuotaCheckError = (data: any): boolean => {
    return data?.code === 'BILLING_QUOTA_CHECK_ERROR'
  }

  // Temporarily disable functionality after billing error
  const disableTemporarily = useCallback(() => {
    setButtonDisabledUntil(Date.now() + 5000) // 5 second cooldown
    setTimeout(() => setButtonDisabledUntil(0), 5000)
  }, [])

  const isDisabled = useCallback(() => Date.now() < buttonDisabledUntil, [buttonDisabledUntil])

  const clearBillingError = useCallback(() => {
    setBillingLimitError({ isOverLimit: false })
  }, [])

  const createWebCall = async (agentId: string): Promise<WebCallSession | null> => {
    if (!agentId) {
      toast({
        title: "Error",
        description: "Agent ID is required for web call",
        variant: "destructive"
      })
      return null
    }

    try {
      setLoading(true)

      const { data, error } = await supabase.functions.invoke('retell-webcall-create', {
        body: { agent_id: agentId }
      })

      // Check for billing over limit in the response data
      if (data && isBillingOverLimit(data)) {
        setBillingLimitError({
          isOverLimit: true,
          message: "You've hit your plan's call limit for this month."
        })
        disableTemporarily()
        toast({
          title: "Call Limit Reached",
          description: "You've hit your plan's call limit for this month. Update your plan in Billing to continue.",
          variant: "destructive"
        })
        return null
      }

      // Check for transient quota check error
      if (data && isBillingQuotaCheckError(data)) {
        setBillingLimitError({ isOverLimit: false })
        toast({
          title: "Please try again",
          description: "We're temporarily unable to verify your usage. Please try again in a moment.",
          variant: "default"
        })
        return null
      }

      if (error) {
        // Also check error object for billing limit
        const errorData = error?.message ? JSON.parse(error.message).body || {} : {}
        if (isBillingOverLimit(errorData)) {
          setBillingLimitError({
            isOverLimit: true,
            message: "You've hit your plan's call limit for this month."
          })
          disableTemporarily()
          toast({
            title: "Call Limit Reached",
            description: "You've hit your plan's call limit for this month. Update your plan in Billing to continue.",
            variant: "destructive"
          })
          return null
        }
        // Check for transient quota check error in error data
        if (isBillingQuotaCheckError(errorData)) {
          setBillingLimitError({ isOverLimit: false })
          toast({
            title: "Please try again",
            description: "We're temporarily unable to verify your usage. Please try again in a moment.",
            variant: "default"
          })
          return null
        }
        throw error
      }

      setBillingLimitError({ isOverLimit: false })
      setSession(data)

      toast({
        title: "Web Call Ready",
        description: "Browser call session created successfully",
      })

      return data
    } catch (error) {
      console.error('Error creating web call:', error)
      toast({
        title: "Error",
        description: "Failed to create web call session",
        variant: "destructive"
      })
      return null
    } finally {
      setLoading(false)
    }
  }

  const endWebCall = () => {
    setSession(null)
  }

  return {
    loading,
    session,
    billingLimitError,
    isDisabled,
    createWebCall,
    endWebCall,
    clearBillingError,
  }
}
