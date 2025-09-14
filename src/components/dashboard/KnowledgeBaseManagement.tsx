import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpen, Plus, Upload, Link, Type, Trash2, Settings, RefreshCw } from 'lucide-react'
import { useRetellKnowledgeBase } from '@/hooks/useRetellKnowledgeBase'
import { useRetellAgents } from '@/hooks/useRetellAgents'
import { useUserOrganization } from '@/hooks/useUserOrganization'
import { useToast } from '@/hooks/use-toast'

export const KnowledgeBaseManagement = () => {
  const { organization } = useUserOrganization()
  const { knowledgeBases, loading, createKnowledgeBase, addSource, deleteSource, getKBStatus } = useRetellKnowledgeBase(organization?.id)
  const { agents, attachKBToAgent } = useRetellAgents(organization?.id)
  const { toast } = useToast()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [addSourceDialogOpen, setAddSourceDialogOpen] = useState(false)
  const [selectedKB, setSelectedKB] = useState<string>('')
  const [newKBTitle, setNewKBTitle] = useState('')
  const [sourceType, setSourceType] = useState<'file' | 'url' | 'text'>('file')
  const [sourceContent, setSourceContent] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const [addingSource, setAddingSource] = useState(false)

  const handleCreateKB = async () => {
    if (!newKBTitle.trim()) return
    
    setCreating(true)
    try {
      await createKnowledgeBase(newKBTitle.trim())
      setCreateDialogOpen(false)
      setNewKBTitle('')
    } catch (error) {
      // Error handled in hook
    } finally {
      setCreating(false)
    }
  }

  const handleAddSource = async () => {
    if (!selectedKB || !sourceName.trim()) return

    setAddingSource(true)
    try {
      let content = sourceContent
      
      if (sourceType === 'file' && selectedFile) {
        // Convert file to base64
        const fileContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            const base64 = result.split(',')[1]
            resolve(base64)
          }
          reader.onerror = reject
          reader.readAsDataURL(selectedFile)
        })
        content = fileContent
      }

      await addSource(selectedKB, sourceType, content, sourceName.trim())
      setAddSourceDialogOpen(false)
      setSourceContent('')
      setSourceName('')
      setSelectedFile(null)
    } catch (error) {
      // Error handled in hook
    } finally {
      setAddingSource(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setSourceName(file.name)
    }
  }

  const handleAttachKBToAgent = async (agentId: string, kbIds: string[]) => {
    try {
      await attachKBToAgent(agentId, kbIds)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to attach knowledge base to agent.",
        variant: "destructive"
      })
    }
  }

  const getStatusBadge = (kb: any) => {
    switch (kb.state) {
      case 'ready':
        return <Badge variant="default">Ready</Badge>
      case 'pending':
        return <Badge variant="secondary">Indexing</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const refreshKBStatus = async (kbId: string) => {
    try {
      await getKBStatus(kbId)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh knowledge base status.",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex gap-4">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Knowledge Base
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Knowledge Base</DialogTitle>
              <DialogDescription>
                Create a new knowledge base to store information for your agents.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="kb-title">Knowledge Base Title</Label>
                <Input
                  id="kb-title"
                  placeholder="e.g., Product Documentation"
                  value={newKBTitle}
                  onChange={(e) => setNewKBTitle(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleCreateKB} 
                disabled={creating || !newKBTitle.trim()}
                className="w-full"
              >
                {creating ? 'Creating...' : 'Create Knowledge Base'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={addSourceDialogOpen} onOpenChange={setAddSourceDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Source
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Source to Knowledge Base</DialogTitle>
              <DialogDescription>
                Add files, URLs, or text content to enhance your knowledge base.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Knowledge Base</Label>
                <Select value={selectedKB} onValueChange={setSelectedKB}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a knowledge base" />
                  </SelectTrigger>
                  <SelectContent>
                    {knowledgeBases?.map((kb) => (
                      <SelectItem key={kb.id} value={kb.id}>
                        {kb.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Tabs value={sourceType} onValueChange={(value) => setSourceType(value as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="file" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    File
                  </TabsTrigger>
                  <TabsTrigger value="url" className="flex items-center gap-2">
                    <Link className="h-4 w-4" />
                    URL
                  </TabsTrigger>
                  <TabsTrigger value="text" className="flex items-center gap-2">
                    <Type className="h-4 w-4" />
                    Text
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="file" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="file-upload">Upload File</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.md"
                      onChange={handleFileSelect}
                    />
                  </div>
                  {selectedFile && (
                    <div className="text-sm text-muted-foreground">
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="url" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="source-name">Source Name</Label>
                    <Input
                      id="source-name"
                      placeholder="e.g., Product Documentation"
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url-content">URL</Label>
                    <Input
                      id="url-content"
                      placeholder="https://example.com/docs"
                      value={sourceContent}
                      onChange={(e) => setSourceContent(e.target.value)}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="text" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="text-name">Source Name</Label>
                    <Input
                      id="text-name"
                      placeholder="e.g., FAQ Content"
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="text-content">Text Content</Label>
                    <Textarea
                      id="text-content"
                      placeholder="Enter your text content here..."
                      value={sourceContent}
                      onChange={(e) => setSourceContent(e.target.value)}
                      rows={8}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <Button 
                onClick={handleAddSource} 
                disabled={addingSource || !selectedKB || !sourceName.trim()}
                className="w-full"
              >
                {addingSource ? 'Adding Source...' : 'Add Source'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Knowledge Bases Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Knowledge Bases
          </CardTitle>
          <CardDescription>
            Manage your knowledge bases and attach them to agents for enhanced responses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading knowledge bases...</div>
            </div>
          ) : knowledgeBases?.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No knowledge bases</h3>
              <p className="text-muted-foreground mb-4">
                Create your first knowledge base to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sources</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>Attached Agents</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {knowledgeBases?.map((kb) => (
                  <TableRow key={kb.id}>
                    <TableCell className="font-medium">{kb.title}</TableCell>
                    <TableCell>{getStatusBadge(kb)}</TableCell>
                    <TableCell>{kb.source_count}</TableCell>
                    <TableCell>{kb.chunks}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {agents?.filter(agent => agent.kb_ids?.includes(kb.kb_id)).map(agent => (
                          <Badge key={agent.id} variant="outline" className="text-xs">
                            {agent.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(kb.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => refreshKBStatus(kb.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => deleteSource(kb.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Agent KB Attachments */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Knowledge Base Attachments</CardTitle>
          <CardDescription>
            Attach knowledge bases to agents to enhance their responses with relevant information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agents?.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">No agents available</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attached Knowledge Bases</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents?.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell>
                      <Badge variant={agent.status === 'published' ? 'default' : 'secondary'}>
                        {agent.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {agent.kb_ids?.map(kbId => {
                          const kb = knowledgeBases?.find(kb => kb.kb_id === kbId)
                          return kb ? (
                            <Badge key={kbId} variant="outline" className="text-xs">
                              {kb.title}
                            </Badge>
                          ) : null
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value=""
                        onValueChange={(kbId) => {
                          const currentKBs = agent.kb_ids || []
                          if (!currentKBs.includes(kbId)) {
                            handleAttachKBToAgent(agent.id, [...currentKBs, kbId])
                          }
                        }}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Attach KB" />
                        </SelectTrigger>
                        <SelectContent>
                          {knowledgeBases?.filter(kb => !agent.kb_ids?.includes(kb.kb_id)).map((kb) => (
                            <SelectItem key={kb.id} value={kb.kb_id}>
                              {kb.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}