import { useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface SecureResourceAccess {
  generateSignedUrl: (resourceType: 'recording' | 'transcript' | 'analysis', resourceId: string) => Promise<string | null>
  loading: boolean
}

export const useSecureResourceAccess = (): SecureResourceAccess => {
  const [loading, setLoading] = useState(false)

  const generateSignedUrl = useCallback(async (
    resourceType: 'recording' | 'transcript' | 'analysis', 
    resourceId: string
  ): Promise<string | null> => {
    setLoading(true)
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-signed-url', {
        body: {
          resource_type: resourceType,
          resource_id: resourceId,
          expires_in: 3600 // 1 hour
        }
      })

      if (error) {
        console.error('Error generating signed URL:', error)
        toast.error('Failed to generate secure access URL')
        return null
      }

      return data.signed_url
    } catch (error) {
      console.error('Error generating signed URL:', error)
      toast.error('Failed to generate secure access URL')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    generateSignedUrl,
    loading
  }
}