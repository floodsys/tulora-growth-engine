import { useRetellKnowledgeBase } from "@/hooks/useRetellKnowledgeBase"
import { useUserOrganization } from "@/hooks/useUserOrganization" 
import { useRetellAgents } from "@/hooks/useRetellAgents"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  FileText, 
  Plus, 
  Database,
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"

interface KnowledgeBaseViewProps {
  agent: {
    id: string
    slug: string
    name: string
    category: string
    subtitle: string
    description: string
    tags: string[]
    kb_ids?: string[]
  }
}

export function KnowledgeBaseView({ agent }: KnowledgeBaseViewProps) {
  const [attachDialogOpen, setAttachDialogOpen] = useState(false)
  const [selectedKBs, setSelectedKBs] = useState<string[]>(agent.kb_ids || [])
  
  const { organization } = useUserOrganization()
  const { knowledgeBases, loading: kbLoading } = useRetellKnowledgeBase(organization?.id)
  const { attachKBToAgent } = useRetellAgents(organization?.id)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready":
      case "completed":
        return "bg-success text-success-foreground"
      case "processing":
      case "pending":
        return "bg-warning text-warning-foreground"
      case "error":
      case "failed":
        return "bg-destructive text-destructive-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ready":
      case "completed":
        return <CheckCircle className="h-4 w-4" />
      case "processing":
      case "pending":
        return <Clock className="h-4 w-4" />
      case "error":
      case "failed":
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Database className="h-4 w-4" />
    }
  }

  const handleAttachKBs = async () => {
    await attachKBToAgent(agent.id, selectedKBs)
    setAttachDialogOpen(false)
  }

  const attachedKBs = knowledgeBases.filter(kb => agent.kb_ids?.includes(kb.id))

  if (kbLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Knowledge Base Controls */}
        <div className="lg:col-span-1">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">KNOWLEDGE BASE</h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm mb-2">{agent.name}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This agent can answer questions using attached knowledge bases and documents.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">ATTACHED KNOWLEDGE BASES</h4>
              <div className="space-y-2">
                {attachedKBs.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-2 border border-dashed rounded">
                    No knowledge bases attached
                  </div>
                ) : (
                  attachedKBs.map(kb => (
                    <div key={kb.id} className="flex items-center gap-2 p-2 rounded-md border border-primary/20 bg-primary/5">
                      <Database className="w-4 h-4 text-primary" />
                      <span className="text-sm text-primary">{kb.title}</span>
                      <Badge className={getStatusColor(kb.state)}>
                        {getStatusIcon(kb.state)}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Dialog open={attachDialogOpen} onOpenChange={setAttachDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Manage Knowledge Bases
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Attach Knowledge Bases</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {knowledgeBases.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No knowledge bases available. Create one first in the Knowledge Base section.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {knowledgeBases.map(kb => (
                        <div key={kb.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={kb.id}
                            checked={selectedKBs.includes(kb.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedKBs(prev => [...prev, kb.id])
                              } else {
                                setSelectedKBs(prev => prev.filter(id => id !== kb.id))
                              }
                            }}
                          />
                          <label
                            htmlFor={kb.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                          >
                            {kb.title}
                            <Badge className={getStatusColor(kb.state)}>
                              {kb.source_count} sources
                            </Badge>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button onClick={handleAttachKBs} className="w-full">
                    Update Attachments
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Right Content Area - Attached Knowledge Bases Details */}
        <div className="lg:col-span-3">
          <div className="space-y-4">
            {attachedKBs.length === 0 ? (
              <Card className="border border-border/50">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Knowledge Bases Attached</h3>
                    <p className="text-muted-foreground mb-4">
                      Attach knowledge bases to give your agent access to specific information and documents.
                    </p>
                    <Button onClick={() => setAttachDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Attach Knowledge Base
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              attachedKBs.map(kb => (
                <Card key={kb.id} className="border border-border/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-primary" />
                        <span className="font-medium text-sm text-primary">{kb.title}</span>
                      </div>
                      <Badge className={getStatusColor(kb.state)}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(kb.state)}
                          {kb.state}
                        </div>
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="font-medium">Sources</div>
                        <div className="text-muted-foreground">{kb.source_count}</div>
                      </div>
                      <div>
                        <div className="font-medium">Chunks</div>
                        <div className="text-muted-foreground">{kb.chunks}</div>
                      </div>
                      <div>
                        <div className="font-medium">Last Updated</div>
                        <div className="text-muted-foreground">
                          {kb.last_indexed_at 
                            ? new Date(kb.last_indexed_at).toLocaleDateString()
                            : 'Never'
                          }
                        </div>
                      </div>
                    </div>
                    
                    {kb.sources && kb.sources.length > 0 && (
                      <div className="mt-4">
                        <h5 className="font-medium text-sm mb-2">Sources</h5>
                        <div className="space-y-1">
                          {kb.sources.slice(0, 3).map(source => (
                            <div key={source.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              <span className="truncate">{source.name}</span>
                              <Badge className={getStatusColor(source.status)}>
                                {source.status}
                              </Badge>
                            </div>
                          ))}
                          {kb.sources.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              +{kb.sources.length - 3} more sources
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}