import { useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { getTurnstileSiteKey } from '@/config/turnstile'

interface TurnstileHook {
  verify: (token: string, action?: string) => Promise<boolean>
  isLoading: boolean
  siteKey: string
}

export const useTurnstile = (): TurnstileHook => {
  const [isLoading, setIsLoading] = useState(false)
  const siteKey = getTurnstileSiteKey()

  const verify = useCallback(async (token: string, action?: string): Promise<boolean> => {
    setIsLoading(true)
    
    try {
      const { data, error } = await supabase.functions.invoke('verify-turnstile', {
        body: {
          token,
          action,
          remoteip: undefined // Let server determine IP
        }
      })

      if (error) {
        console.error('Turnstile verification error:', error)
        return false
      }

      return data.success === true
    } catch (error) {
      console.error('Turnstile verification failed:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    verify,
    isLoading,
    siteKey
  }
}