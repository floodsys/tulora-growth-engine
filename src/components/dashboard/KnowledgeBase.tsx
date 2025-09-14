import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  Upload, 
  Search, 
  FileText, 
  Download, 
  Trash2,
  File,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"

interface KnowledgeFile {
  id: string
  name: string
  type: string
  size: number
  status: "processing" | "ready" | "error"
  uploadedAt: Date
  chunks: number
  embeddings: number
}

interface SearchResult {
  id: string
  filename: string
  content: string
  relevance: number
}

const mockFiles: KnowledgeFile[] = [
  {
    id: "1",
    name: "Product Documentation.pdf",
    type: "pdf",
    size: 2400000,
    status: "ready",
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    chunks: 45,
    embeddings: 45
  },
  {
    id: "2",
    name: "Sales Playbook.docx", 
    type: "docx",
    size: 1800000,
    status: "processing",
    uploadedAt: new Date(Date.now() - 1000 * 60 * 30),
    chunks: 0,
    embeddings: 0
  },
  {
    id: "3",
    name: "FAQ Database.txt",
    type: "txt", 
    size: 450000,
    status: "ready",
    uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    chunks: 23,
    embeddings: 23
  }
]

const mockSearchResults: SearchResult[] = [
  {
    id: "1",
    filename: "Product Documentation.pdf",
    content: "Our AI-powered outreach platform helps sales teams automate personalized communications while maintaining authentic connections with prospects...",
    relevance: 0.94
  },
  {
    id: "2", 
    filename: "Sales Playbook.docx",
    content: "When reaching out to prospects, always start with personalization. Research their company, recent news, and identify specific pain points...",
    relevance: 0.87
  },
  {
    id: "3",
    filename: "FAQ Database.txt",
    content: "Q: How does the AI maintain personalization at scale? A: Our system analyzes prospect data, company information, and interaction history...",
    relevance: 0.82
  }
]

export function KnowledgeBase() {
  const [files, setFiles] = useState(mockFiles)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const { toast } = useToast()

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready":
        return "bg-success text-success-foreground"
      case "processing":
        return "bg-warning text-warning-foreground"
      case "error":
        return "bg-destructive text-destructive-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ready":
        return <CheckCircle className="h-4 w-4" />
      case "processing":
        return <Clock className="h-4 w-4" />
      case "error":
        return <AlertCircle className="h-4 w-4" />
      default:
        return <File className="h-4 w-4" />
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const newFile: KnowledgeFile = {
      id: Date.now().toString(),
      name: file.name,
      type: file.name.split('.').pop() || 'unknown',
      size: file.size,
      status: "processing",
      uploadedAt: new Date(),
      chunks: 0,
      embeddings: 0
    }

    setFiles(prev => [newFile, ...prev])
    
    toast({
      title: "File Uploaded",
      description: `${file.name} is being processed and will be available shortly.`,
    })

    // Simulate processing
    setTimeout(() => {
      setFiles(prev => prev.map(f => 
        f.id === newFile.id 
          ? { ...f, status: "ready", chunks: 32, embeddings: 32 }
          : f
      ))
    }, 3000)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    
    // Simulate search delay
    setTimeout(() => {
      setSearchResults(mockSearchResults)
      setIsSearching(false)
    }, 1000)
  }

  const handleDeleteFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
    toast({
      title: "File Deleted",
      description: "The file has been removed from your knowledge base.",
    })
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
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.md"
            onChange={handleFileUpload}
          />
          <Button onClick={() => document.getElementById('file-upload')?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
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

      {/* Upload Progress */}
      {files.some(f => f.status === "processing") && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Files</CardTitle>
          </CardHeader>
          <CardContent>
            {files.filter(f => f.status === "processing").map((file) => (
              <div key={file.id} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{file.name}</span>
                  <span>Processing...</span>
                </div>
                <Progress value={65} className="w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Files Table */}
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {file.name}
                    </div>
                  </TableCell>
                  <TableCell className="uppercase text-xs font-mono">
                    {file.type}
                  </TableCell>
                  <TableCell>{formatFileSize(file.size)}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(file.status)}>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(file.status)}
                        {file.status}
                      </div>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {file.chunks > 0 ? `${file.chunks} chunks` : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(file.uploadedAt, { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteFile(file.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}