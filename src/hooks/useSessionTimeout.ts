import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useUserOrganization } from '@/hooks/useUserOrganization'
import { toast } from 'sonner'

/**
 * Frontend session timeout enforcement
 * Policy: Enforces MAX session age from creation time based on org settings
 * Backend guard handles JWT expiry and org-active status
 */
export function useSessionTimeout() {
  const { organization } = useUserOrganization()
  const [settings, setSettings] = useState<any>(null)
  
  // Fetch organization settings
  useEffect(() => {
    if (!organization?.id) return
    
    const fetchSettings = async () => {
      // Query organizations table directly
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organization.id)
        .single()
      
      // The settings column exists as JSONB in the database
      if (orgData && 'settings' in orgData) {
        setSettings((orgData as any).settings)
      }
    }
    
    fetchSettings()
  }, [organization?.id])
  
  useEffect(() => {
    // Get current session
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (!session || !settings?.session_timeout_minutes) return
      
      const timeoutMinutes = settings.session_timeout_minutes
      if (timeoutMinutes <= 0) return // Disabled
      
      // Policy: Enforce MAX session age from creation
      // Note: session doesn't have created_at, so we use expires_at - token lifetime
      // For now, we'll use the access_token issue time (iat claim if available)
      const tokenPayload = session.access_token ? 
        JSON.parse(atob(session.access_token.split('.')[1])) : null
      
      if (!tokenPayload?.iat) {
        console.warn('Session timeout: Unable to determine session creation time')
        return
      }
      
      const sessionCreatedAt = tokenPayload.iat * 1000 // Convert to milliseconds
      const maxAge = timeoutMinutes * 60 * 1000
      const expiresAt = sessionCreatedAt + maxAge
      
      const checkTimeout = () => {
        if (Date.now() > expiresAt) {
          supabase.auth.signOut()
          toast.error('Session expired due to organization policy')
        }
      }
      
      // Check immediately
      checkTimeout()
      
      // Check every minute
      const interval = setInterval(checkTimeout, 60000)
      
      return () => clearInterval(interval)
    }
    
    checkSession()
  }, [settings?.session_timeout_minutes])
}
