import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

// Helper for correlation ID extraction
const getCorrId = (err: any) => err?.correlationId ?? err?.corr ?? err?.traceId ?? null

export interface RetellKB {
  id: string
  organization_id: string
  kb_id: string
  title: string
  source_count: number
  chunks: number
  state: string
  last_indexed_at?: string
  created_at: string
  updated_at: string
  sources?: RetellKBSource[]
}

export interface RetellKBSource {
  id: string
  kb_id: string
  source_id: string
  type: 'file' | 'url' | 'text'
  name: string
  size?: number
  status: string
  error_message?: string
  metadata?: any
  created_at: string
  updated_at: string
}

export const useRetellKnowledgeBase = (organizationId?: string) => {
  const [knowledgeBases, setKnowledgeBases] = useState<RetellKB[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Load knowledge bases
  const loadKnowledgeBases = async () => {
    if (!organizationId) return

    try {
      setLoading(true)
      const { data, error } = await supabase.functions.invoke('retell-kb-list', {
        body: { organizationId }
      })

      if (error) throw error
      setKnowledgeBases(data || [])
    } catch (error) {
      const corrId = getCorrId(error)
      console.error('Error loading knowledge bases:', { corrId, error })
      toast({
        title: "Error",
        description: `Failed to load knowledge bases.${corrId ? ` (Corr ID: ${corrId})` : ''}`,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Create knowledge base
  const createKnowledgeBase = async (title: string) => {
    if (!organizationId) return null

    try {
      const { data, error } = await supabase.functions.invoke('retell-kb-create', {
        body: { title, organizationId }
      })

      if (error) throw error

      setKnowledgeBases(prev => [data, ...prev])
      
      toast({
        title: "Knowledge Base Created",
        description: "New knowledge base has been created successfully.",
      })

      return data
    } catch (error) {
      const corrId = getCorrId(error)
      console.error('Error creating knowledge base:', { corrId, error })
      toast({
        title: "Error",
        description: `Failed to create knowledge base.${corrId ? ` (Corr ID: ${corrId})` : ''}`,
        variant: "destructive"
      })
      return null
    }
  }

  // Add source to knowledge base
  const addSource = async (kbId: string, type: 'file' | 'url' | 'text', content: string, name: string, options?: { enable_auto_refresh?: boolean }) => {
    if (!organizationId) return null

    try {
      const { data, error } = await supabase.functions.invoke('retell-kb-add-source', {
        body: { kbId, type, content, name, organizationId, options }
      })

      if (error) throw error

      // Refresh knowledge bases to get updated source count
      await loadKnowledgeBases()

      toast({
        title: "Source Added",
        description: `${name} has been added to the knowledge base.`,
      })

      return data
    } catch (error) {
      const corrId = getCorrId(error)
      console.error('Error adding source:', { corrId, error })
      toast({
        title: "Error",
        description: `Failed to add source to knowledge base.${corrId ? ` (Corr ID: ${corrId})` : ''}`,
        variant: "destructive"
      })
      return null
    }
  }

  // Delete source from knowledge base
  const deleteSource = async (sourceId: string) => {
    if (!organizationId) return false

    try {
      const { data, error } = await supabase.functions.invoke('retell-kb-delete-source', {
        body: { sourceId, organizationId }
      })

      if (error) throw error

      // Refresh knowledge bases to get updated source count
      await loadKnowledgeBases()

      toast({
        title: "Source Deleted",
        description: "Source has been removed from the knowledge base.",
      })

      return true
    } catch (error) {
      const corrId = getCorrId(error)
      console.error('Error deleting source:', { corrId, error })
      toast({
        title: "Error",
        description: `Failed to delete source.${corrId ? ` (Corr ID: ${corrId})` : ''}`,
        variant: "destructive"
      })
      return false
    }
  }

  // Get knowledge base status
  const getKBStatus = async (kbId: string) => {
    if (!organizationId) return null

    try {
      const { data, error } = await supabase.functions.invoke('retell-kb-status', {
        body: { kbId, organizationId }
      })

      if (error) throw error

      // Update local state
      setKnowledgeBases(prev => prev.map(kb => 
        kb.id === kbId ? { ...kb, ...data } : kb
      ))

      return data
    } catch (error) {
      const corrId = getCorrId(error)
      console.error('Error getting KB status:', { corrId, error })
      toast({
        title: "Error",
        description: `Failed to get knowledge base status.${corrId ? ` (Corr ID: ${corrId})` : ''}`,
        variant: "destructive"
      })
      return null
    }
  }

  // Upload file and add as source
  const uploadFile = async (kbId: string, file: File) => {
    if (!organizationId) return null

    try {
      // Convert file to base64
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Remove data:mime/type;base64, prefix
          const base64 = result.split(',')[1]
          resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      return await addSource(kbId, 'file', fileContent, file.name)
    } catch (error) {
      const corrId = getCorrId(error)
      console.error('Error uploading file:', { corrId, error })
      toast({
        title: "Error",
        description: `Failed to upload file.${corrId ? ` (Corr ID: ${corrId})` : ''}`,
        variant: "destructive"
      })
      return null
    }
  }

  useEffect(() => {
    if (organizationId) {
      loadKnowledgeBases()
    }
  }, [organizationId])

  return {
    knowledgeBases,
    loading,
    loadKnowledgeBases,
    createKnowledgeBase,
    addSource,
    deleteSource,
    getKBStatus,
    uploadFile,
  }
}