import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { 
  Upload, 
  Search, 
  FileText, 
  Download, 
  Trash2,
  File,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  Globe,
  MessageSquare,
  RefreshCw
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import { useRetellKnowledgeBase } from "@/hooks/useRetellKnowledgeBase"
import { useUserOrganization } from "@/hooks/useUserOrganization"

interface SearchResult {
  id: string
  filename: string
  content: string
  relevance: number
}

export function KnowledgeBase() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [newKBTitle, setNewKBTitle] = useState("")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [urlToAdd, setUrlToAdd] = useState("")
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [textToAdd, setTextToAdd] = useState("")
  const [textName, setTextName] = useState("")
  const [selectedKB, setSelectedKB] = useState<string>("")
  const { toast } = useToast()
  
  const { organization } = useUserOrganization()
  const { 
    knowledgeBases, 
    loading, 
    createKnowledgeBase, 
    uploadFile, 
    addSource, 
    deleteSource,
    getKBStatus 
  } = useRetellKnowledgeBase(organization?.id)

  // Auto-refresh status for processing items
  useEffect(() => {
    if (!knowledgeBases.length) return

    const processingKBs = knowledgeBases.filter(kb => kb.state === 'processing')
    const processingSources = knowledgeBases.flatMap(kb => 
      kb.sources?.filter(source => source.status === 'processing') || []
    )

    if (processingKBs.length > 0 || processingSources.length > 0) {
      const interval = setInterval(async () => {
        for (const kb of processingKBs) {
          await getKBStatus(kb.id)
        }
      }, 5000) // Check every 5 seconds

      return () => clearInterval(interval)
    }
  }, [knowledgeBases, getKBStatus])

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

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
        return <File className="h-4 w-4" />
    }
  }

  const handleCreateKB = async () => {
    if (!newKBTitle.trim()) return

    const result = await createKnowledgeBase(newKBTitle)
    if (result) {
      setNewKBTitle("")
      setCreateDialogOpen(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedKB) return

    await uploadFile(selectedKB, file)
    // Clear the input
    event.target.value = ""
  }

  const handleAddUrl = async () => {
    if (!urlToAdd.trim() || !selectedKB) return

    await addSource(selectedKB, 'url', urlToAdd, urlToAdd, { enable_auto_refresh: autoRefresh })
    setUrlToAdd("")
    setAutoRefresh(false)
  }

  const handleAddText = async () => {
    if (!textToAdd.trim() || !textName.trim() || !selectedKB) return

    await addSource(selectedKB, 'text', textToAdd, textName)
    setTextToAdd("")
    setTextName("")
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    // TODO: Implement search functionality with Retell API
    // For now, just clear results
    setTimeout(() => {
      setSearchResults([])
      setIsSearching(false)
    }, 1000)
  }

  const handleDeleteSource = async (sourceId: string) => {
    await deleteSource(sourceId)
  }

  // Get all sources from all KBs for the table
  const allSources = knowledgeBases.flatMap(kb => 
    (kb.sources || []).map(source => ({
      ...source,
      kb_title: kb.title
    }))
  )

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Knowledge Base</h2>
          <p className="text-muted-foreground">
            Upload and manage documents to enhance AI agent knowledge
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Knowledge Base
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Knowledge Base</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Knowledge base title"
                  value={newKBTitle}
                  onChange={(e) => setNewKBTitle(e.target.value)}
                />
                <Button onClick={handleCreateKB} className="w-full">
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Search Knowledge Base</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search through your documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? "Searching..." : "Search"}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Search Results</h4>
              {searchResults.map((result) => (
                <div key={result.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium text-sm">{result.filename}</p>
                    <Badge variant="outline">
                      {Math.round(result.relevance * 100)}% match
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{result.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Knowledge Bases Management */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {knowledgeBases.map((kb) => (
          <Card key={kb.id}>
            <CardHeader>
              <CardTitle className="text-lg">{kb.title}</CardTitle>
              <Badge className={getStatusColor(kb.state)}>
                <div className="flex items-center gap-1">
                  {getStatusIcon(kb.state)}
                  {kb.state}
                </div>
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Sources:</span>
                  <span>{kb.source_count}</span>
                </div>
                <div className="flex justify-between">
                  <span>Chunks:</span>
                  <span>{kb.chunks}</span>
                </div>
                {kb.last_indexed_at && (
                  <div className="flex justify-between">
                    <span>Indexed:</span>
                    <span>{formatDistanceToNow(new Date(kb.last_indexed_at), { addSuffix: true })}</span>
                  </div>
                )}
              </div>
              
              <div className="mt-4 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="file"
                    id={`file-upload-${kb.id}`}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt,.md"
                    onChange={(e) => {
                      setSelectedKB(kb.id)
                      handleFileUpload(e)
                    }}
                  />
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => document.getElementById(`file-upload-${kb.id}`)?.click()}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    File
                  </Button>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" onClick={() => setSelectedKB(kb.id)}>
                        <Globe className="h-3 w-3 mr-1" />
                        URL
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add URL to {kb.title}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Input
                          placeholder="https://example.com"
                          value={urlToAdd}
                          onChange={(e) => setUrlToAdd(e.target.value)}
                        />
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="auto-refresh"
                            checked={autoRefresh}
                            onCheckedChange={setAutoRefresh}
                          />
                          <Label htmlFor="auto-refresh" className="text-sm">
                            Auto-refresh (every 12h)
                          </Label>
                        </div>
                        <Button onClick={handleAddUrl} className="w-full">
                          Add URL
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" onClick={() => setSelectedKB(kb.id)}>
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Text
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Text to {kb.title}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Input
                          placeholder="Text name"
                          value={textName}
                          onChange={(e) => setTextName(e.target.value)}
                        />
                        <textarea
                          className="w-full h-32 p-2 border rounded"
                          placeholder="Enter your text content here..."
                          value={textToAdd}
                          onChange={(e) => setTextToAdd(e.target.value)}
                        />
                        <Button onClick={handleAddText} className="w-full">
                          Add Text
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Processing Status */}
      {knowledgeBases.some(kb => 
        kb.state === 'processing' || kb.sources?.some(s => s.status === 'processing')
      ) && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {knowledgeBases
                .filter(kb => kb.state === 'processing')
                .map(kb => (
                  <div key={kb.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Knowledge Base: {kb.title}</span>
                      <span>Processing...</span>
                    </div>
                    <Progress value={65} className="w-full" />
                  </div>
                ))}
              {knowledgeBases
                .flatMap(kb => kb.sources?.filter(s => s.status === 'processing') || [])
                .map(source => (
                  <div key={source.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{source.name}</span>
                      <span>Processing...</span>
                    </div>
                    <Progress value={45} className="w-full" />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Sources Table */}
      {allSources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Knowledge Base</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allSources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {source.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {source.kb_title}
                    </TableCell>
                    <TableCell className="uppercase text-xs font-mono">
                      {source.type}
                    </TableCell>
                    <TableCell>
                      {source.size ? formatFileSize(source.size) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(source.status)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(source.status)}
                            {source.status}
                          </div>
                        </Badge>
                        {source.type === 'url' && source.metadata?.enable_auto_refresh && (
                          <Badge variant="outline" className="text-xs">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Auto-refresh
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(source.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteSource(source.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}