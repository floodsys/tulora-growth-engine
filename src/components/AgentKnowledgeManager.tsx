import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { 
  Database, 
  Plus, 
  FileText, 
  Link, 
  Type,
  CheckCircle,
  AlertCircle,
  Clock,
  Upload,
  X,
  RefreshCw,
  Trash2
} from "lucide-react"
import { useRetellKnowledgeBase } from "@/hooks/useRetellKnowledgeBase"
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { useToast } from "@/hooks/use-toast"

interface AgentKnowledgeManagerProps {
  agentId: string
  currentKBIds?: string[]
  onKBsUpdated?: (kbIds: string[]) => void
}

export function AgentKnowledgeManager({ 
  agentId, 
  currentKBIds = [], 
  onKBsUpdated 
}: AgentKnowledgeManagerProps) {
  const [selectedKBs, setSelectedKBs] = useState<string[]>(currentKBIds)
  const [attachDialogOpen, setAttachDialogOpen] = useState(false)
  const [createKBOpen, setCreateKBOpen] = useState(false)
  const [newKBName, setNewKBName] = useState("")
  const [addSourceOpen, setAddSourceOpen] = useState<string | null>(null)
  const [sourceType, setSourceType] = useState<'file' | 'url' | 'text'>('file')
  const [sourceContent, setSourceContent] = useState("")
  const [sourceName, setSourceName] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const { organization } = useUserOrganization()
  const { 
    knowledgeBases, 
    loading, 
    createKnowledgeBase, 
    addSource, 
    deleteSource,
    getKBStatus,
    uploadFile
  } = useRetellKnowledgeBase(organization?.id)
  const { toast } = useToast()

  useEffect(() => {
    setSelectedKBs(currentKBIds)
  }, [currentKBIds])

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

  const handleCreateKB = async () => {
    if (!newKBName.trim()) return

    const kb = await createKnowledgeBase(newKBName.trim())
    if (kb) {
      setNewKBName("")
      setCreateKBOpen(false)
      setSelectedKBs(prev => [...prev, kb.id])
      toast({
        title: "Knowledge Base Created",
        description: "You can now add sources to it and attach to your agent."
      })
    }
  }

  const handleAddSource = async (kbId: string) => {
    if (!sourceName.trim()) {
      toast({
        title: "Source name required",
        description: "Please provide a name for this source.",
        variant: "destructive"
      })
      return
    }

    let content = sourceContent
    let name = sourceName

    if (sourceType === 'file') {
      if (!selectedFile) {
        toast({
          title: "File required",
          description: "Please select a file to upload.",
          variant: "destructive"
        })
        return
      }
      
      const result = await uploadFile(kbId, selectedFile)
      if (result) {
        setAddSourceOpen(null)
        setSourceContent("")
        setSourceName("")
        setSelectedFile(null)
        toast({
          title: "File uploaded",
          description: "Your file has been added to the knowledge base."
        })
      }
      return
    }

    if (sourceType === 'url' && !sourceContent.startsWith('http')) {
      toast({
        title: "Invalid URL",
        description: "Please provide a valid URL starting with http:// or https://",
        variant: "destructive"
      })
      return
    }

    const result = await addSource(kbId, sourceType, content, name)
    if (result) {
      setAddSourceOpen(null)
      setSourceContent("")
      setSourceName("")
      setSelectedFile(null)
    }
  }

  const handleAttachKBs = () => {
    onKBsUpdated?.(selectedKBs)
    setAttachDialogOpen(false)
    toast({
      title: "Knowledge Bases Updated",
      description: `${selectedKBs.length} knowledge bases attached to agent.`
    })
  }

  const handleRefreshStatus = async (kbId: string) => {
    await getKBStatus(kbId)
  }

  const attachedKBs = knowledgeBases.filter(kb => selectedKBs.includes(kb.id))

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Attached Knowledge Bases */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Knowledge Bases ({attachedKBs.length})
            </CardTitle>
            <div className="flex gap-2">
              <Dialog open={createKBOpen} onOpenChange={setCreateKBOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create KB
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Knowledge Base</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="kbName">Knowledge Base Name</Label>
                      <Input
                        id="kbName"
                        value={newKBName}
                        onChange={(e) => setNewKBName(e.target.value)}
                        placeholder="e.g., Product Documentation"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setCreateKBOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateKB} disabled={!newKBName.trim()}>
                        Create
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={attachDialogOpen} onOpenChange={setAttachDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Database className="h-4 w-4 mr-2" />
                    Manage
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Attach Knowledge Bases</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {knowledgeBases.length === 0 ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No knowledge bases available. Create one first.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
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
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 flex-1"
                            >
                              <span className="truncate">{kb.title}</span>
                              <Badge className={getStatusColor(kb.state)} variant="outline">
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
        </CardHeader>
        <CardContent>
          {attachedKBs.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Knowledge Bases Attached</h3>
              <p className="text-muted-foreground mb-4">
                Attach knowledge bases to give your agent access to specific information.
              </p>
              <Button onClick={() => setAttachDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Attach Knowledge Base
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {attachedKBs.map(kb => (
                <Card key={kb.id} className="border border-border/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-primary" />
                        <span className="font-medium">{kb.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(kb.state)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(kb.state)}
                            {kb.state}
                          </div>
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleRefreshStatus(kb.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Dialog open={addSourceOpen === kb.id} onOpenChange={(open) => setAddSourceOpen(open ? kb.id : null)}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Plus className="h-4 w-4 mr-2" />
                              Add Source
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add Source to {kb.title}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Source Type</Label>
                                <Select value={sourceType} onValueChange={(value: 'file' | 'url' | 'text') => setSourceType(value)}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="file">
                                      <div className="flex items-center gap-2">
                                        <Upload className="h-4 w-4" />
                                        File Upload
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="url">
                                      <div className="flex items-center gap-2">
                                        <Link className="h-4 w-4" />
                                        Website URL
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="text">
                                      <div className="flex items-center gap-2">
                                        <Type className="h-4 w-4" />
                                        Text Content
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label htmlFor="sourceName">Source Name</Label>
                                <Input
                                  id="sourceName"
                                  value={sourceName}
                                  onChange={(e) => setSourceName(e.target.value)}
                                  placeholder="Enter a descriptive name"
                                />
                              </div>

                              {sourceType === 'file' && (
                                <div>
                                  <Label htmlFor="file">File</Label>
                                  <Input
                                    id="file"
                                    type="file"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      setSelectedFile(file || null)
                                      if (file && !sourceName) {
                                        setSourceName(file.name)
                                      }
                                    }}
                                    accept=".pdf,.doc,.docx,.txt,.md"
                                  />
                                </div>
                              )}

                              {sourceType === 'url' && (
                                <div>
                                  <Label htmlFor="url">Website URL</Label>
                                  <Input
                                    id="url"
                                    value={sourceContent}
                                    onChange={(e) => setSourceContent(e.target.value)}
                                    placeholder="https://example.com/page"
                                  />
                                </div>
                              )}

                              {sourceType === 'text' && (
                                <div>
                                  <Label htmlFor="text">Text Content</Label>
                                  <Textarea
                                    id="text"
                                    value={sourceContent}
                                    onChange={(e) => setSourceContent(e.target.value)}
                                    placeholder="Paste your text content here..."
                                    rows={6}
                                  />
                                </div>
                              )}

                              <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setAddSourceOpen(null)}>
                                  Cancel
                                </Button>
                                <Button onClick={() => handleAddSource(kb.id)}>
                                  Add Source
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-3 gap-4 text-sm mb-4">
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
                      <div>
                        <h5 className="font-medium text-sm mb-2">Sources</h5>
                        <div className="space-y-2">
                          {kb.sources.map(source => (
                            <div key={source.id} className="flex items-center justify-between p-2 border rounded">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span className="text-sm truncate">{source.name}</span>
                                <Badge className={getStatusColor(source.status)} variant="outline">
                                  {source.status}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteSource(source.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}