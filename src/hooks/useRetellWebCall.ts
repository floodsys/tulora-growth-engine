import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface WebCallSession {
  call_id: string
  access_token: string
  client_secret?: string
}

export const useRetellWebCall = () => {
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<WebCallSession | null>(null)
  const { toast } = useToast()

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

      if (error) throw error

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
    createWebCall,
    endWebCall,
  }
}