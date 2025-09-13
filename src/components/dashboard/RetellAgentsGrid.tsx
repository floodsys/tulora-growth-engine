import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Bot, Plus, Settings, Upload, Volume2, Trash2 } from "lucide-react"
import { useRetellAgents, type RetellAgent } from "@/hooks/useRetellAgents"
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { useToast } from "@/hooks/use-toast"
import { ChatEmbedDialog } from "./ChatEmbedDialog"
import { ChatTester } from "./ChatTester"

interface RetellAgentsGridProps {
  className?: string
}

export const RetellAgentsGrid = ({ className = "" }: RetellAgentsGridProps) => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { organization } = useUserOrganization()
  const { 
    agents, 
    voices, 
    loading, 
    voicesLoading,
    createAgent, 
    publishAgent, 
    deleteAgent 
  } = useRetellAgents(organization?.id)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newAgentName, setNewAgentName] = useState("")
  const [newAgentVoice, setNewAgentVoice] = useState("")
  const [newAgentLanguage, setNewAgentLanguage] = useState("en")
  const [creating, setCreating] = useState(false)

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) {
      toast({
        title: "Error",
        description: "Agent name is required.",
        variant: "destructive"
      })
      return
    }

    setCreating(true)
    try {
      // Generate a unique agent ID for Retell
      const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const agent = await createAgent({
        agent_id: agentId,
        name: newAgentName.trim(),
        language: newAgentLanguage,
        voice_id: newAgentVoice || undefined,
        status: 'draft'
      })

      if (agent) {
        setCreateDialogOpen(false)
        setNewAgentName("")
        setNewAgentVoice("")
        setNewAgentLanguage("en")
        
        // Navigate to the new agent's settings
        navigate(`/retell-agent/${agent.agent_id}`)
      }
    } catch (error) {
      console.error('Error creating agent:', error)
    } finally {
      setCreating(false)
    }
  }

  const handlePublishAgent = async (agent: RetellAgent) => {
    await publishAgent(agent.id)
  }

  const handleDeleteAgent = async (agent: RetellAgent) => {
    if (confirm(`Are you sure you want to delete "${agent.name}"?`)) {
      await deleteAgent(agent.id)
    }
  }

  const formatDuration = (ms: number) => {
    const minutes = Math.round(ms / 60000)
    return `${minutes}m`
  }

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Retell Agents</h3>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-full"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Retell Agents ({agents.length})</h3>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Retell Agent</DialogTitle>
              <DialogDescription>
                Set up a new voice agent with Retell AI configuration.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="agent-name">Agent Name</Label>
                <Input
                  id="agent-name"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="Enter agent name"
                />
              </div>

              <div>
                <Label htmlFor="agent-language">Language</Label>
                <Select value={newAgentLanguage} onValueChange={setNewAgentLanguage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="it">Italian</SelectItem>
                    <SelectItem value="pt">Portuguese</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="agent-voice">Voice (Optional)</Label>
                <Select 
                  value={newAgentVoice} 
                  onValueChange={setNewAgentVoice}
                  disabled={voicesLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={voicesLoading ? "Loading voices..." : "Select a voice"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="">No voice selected</SelectItem>
                    {voices.map((voice) => (
                      <SelectItem key={voice.voice_id} value={voice.voice_id}>
                        {voice.voice_name} ({voice.gender}, {voice.accent})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateAgent} disabled={creating}>
                  {creating ? "Creating..." : "Create Agent"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {agents.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Retell Agents</h3>
            <p className="text-muted-foreground mb-6">
              Create your first Retell agent to get started with voice AI.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card key={agent.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center">
                      <Bot className="h-5 w-5 mr-2 text-primary" />
                      {agent.name}
                    </CardTitle>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge variant={agent.status === 'published' ? 'default' : 'secondary'}>
                        {agent.status === 'published' ? `v${agent.version}` : 'Draft'}
                      </Badge>
                      {agent.voice_id && (
                        <Badge variant="outline" className="text-xs">
                          <Volume2 className="h-3 w-3 mr-1" />
                          Voice
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Language:</span>
                      <div className="font-medium">{agent.language.toUpperCase()}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Max Duration:</span>
                      <div className="font-medium">{formatDuration(agent.max_call_duration_ms)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Transfer:</span>
                      <div className="font-medium capitalize">{agent.transfer_mode}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Storage:</span>
                      <div className="font-medium capitalize">{agent.data_storage_setting}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/retell-agent/${agent.agent_id}`)}
                        className="flex-1"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                      
                      {agent.status === 'draft' ? (
                        <Button
                          size="sm"
                          onClick={() => handlePublishAgent(agent)}
                          className="flex-1"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Publish
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteAgent(agent)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    {agent.status === 'published' && (
                      <div className="flex space-x-2">
                        <ChatEmbedDialog agent={agent} />
                        <ChatTester agent={agent} />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}