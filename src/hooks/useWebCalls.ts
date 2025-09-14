import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { useUserOrganization } from '@/hooks/useUserOrganization'

export const useWebCalls = () => {
  const { organization } = useUserOrganization()
  const { toast } = useToast()
  
  const [isConnected, setIsConnected] = useState(false)
  const [isCallActive, setIsCallActive] = useState(false)
  const [currentCallId, setCurrentCallId] = useState<string | null>(null)
  const [retellClient, setRetellClient] = useState<any>(null)

  // Initialize Retell client
  useEffect(() => {
    const initializeRetell = async () => {
      try {
        // Import Retell SDK dynamically
        const { RetellWebClient } = await import('retell-client-js-sdk')
        const client = new RetellWebClient()
        
        client.on('call_started', () => {
          console.log('Call started')
          setIsCallActive(true)
        })
        
        client.on('call_ended', () => {
          console.log('Call ended')
          setIsCallActive(false)
          setCurrentCallId(null)
        })
        
        client.on('error', (error: any) => {
          console.error('Retell client error:', error)
          toast({
            title: "Call Error",
            description: "An error occurred during the call.",
            variant: "destructive"
          })
        })

        setRetellClient(client)
      } catch (error) {
        console.error('Failed to initialize Retell client:', error)
      }
    }

    initializeRetell()
  }, [toast])

  // Create web call
  const createWebCall = async (agentId: string) => {
    if (!organization?.id || !retellClient) {
      throw new Error('Missing organization or Retell client not initialized')
    }

    try {
      const { data, error } = await supabase.functions.invoke('retell-webcall-create', {
        body: {
          agent_id: agentId,
          organization_id: organization.id
        }
      })

      if (error) throw error

      setCurrentCallId(data.call_id)
      return data
    } catch (error) {
      console.error('Error creating web call:', error)
      throw error
    }
  }

  // Connect to call
  const connect = async () => {
    if (!retellClient || !currentCallId) return

    try {
      await retellClient.startCall({
        callId: currentCallId,
        sampleRate: 24000,
        enableUpdate: true
      })
      setIsConnected(true)
    } catch (error) {
      console.error('Error connecting to call:', error)
      throw error
    }
  }

  // Disconnect from call
  const disconnect = async () => {
    if (!retellClient) return

    try {
      await retellClient.stopCall()
      setIsConnected(false)
      setIsCallActive(false)
      setCurrentCallId(null)
    } catch (error) {
      console.error('Error disconnecting from call:', error)
      throw error
    }
  }

  // Start call (create + connect)
  const startCall = async (agentId?: string) => {
    try {
      if (agentId) {
        await createWebCall(agentId)
      }
      await connect()
    } catch (error) {
      console.error('Error starting call:', error)
      throw error
    }
  }

  // End call
  const endCall = async () => {
    try {
      await disconnect()
    } catch (error) {
      console.error('Error ending call:', error)
      throw error
    }
  }

  // Toggle mute
  const toggleMute = async () => {
    if (!retellClient) return

    try {
      await retellClient.toggleMute()
    } catch (error) {
      console.error('Error toggling mute:', error)
      throw error
    }
  }

  return {
    isConnected,
    isCallActive,
    currentCallId,
    createWebCall,
    connect,
    disconnect,
    startCall,
    endCall,
    toggleMute,
  }
}