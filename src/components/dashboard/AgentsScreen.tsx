import { useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Bot, Phone, Settings, Star } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Agent {
  id: string
  name: string
  retellId: string
  status: "active" | "inactive" | "training"
  calls: number
  avgDuration: number
  successRate: number
  isDefault: boolean
  // Extended settings
  prompt?: string
  voice?: string
  language?: string
  temperature?: number
  maxTokens?: number
  enableTransfer?: boolean
  transferNumber?: string
  enableRecording?: boolean
}

const mockAgents: Agent[] = [
  {
    id: "1",
    name: "Sales Agent Pro",
    retellId: "agent_12345abcde",
    status: "active",
    calls: 156,
    avgDuration: 180,
    successRate: 68,
    isDefault: true,
    prompt: "You are a professional sales agent. Be friendly, persuasive, and focus on identifying customer needs.",
    voice: "alloy",
    language: "en",
    temperature: 0.7,
    maxTokens: 150,
    enableTransfer: true,
    transferNumber: "+1-555-0100",
    enableRecording: true
  },
  {
    id: "2", 
    name: "Lead Qualifier",
    retellId: "agent_67890fghij",
    status: "active", 
    calls: 89,
    avgDuration: 120,
    successRate: 72,
    isDefault: false,
    prompt: "You are a lead qualification specialist. Ask targeted questions to determine if prospects are qualified leads.",
    voice: "echo",
    language: "en",
    temperature: 0.5,
    maxTokens: 100,
    enableTransfer: false,
    enableRecording: true
  },
  {
    id: "3",
    name: "Follow-up Specialist",
    retellId: "agent_klmno12345",
    status: "inactive",
    calls: 34,
    avgDuration: 95,
    successRate: 45,
    isDefault: false,
    prompt: "You are a follow-up specialist. Be persistent but polite in following up on previous conversations.",
    voice: "fable",
    language: "en",
    temperature: 0.6,
    maxTokens: 120,
    enableTransfer: false,
    enableRecording: false
  }
]

export function AgentsScreen() {
  const [agents, setAgents] = useState(mockAgents)
  const [testCallOpen, setTestCallOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [phoneNumber, setPhoneNumber] = useState("")
  const { toast } = useToast()

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success text-success-foreground"
      case "inactive":
        return "bg-muted text-muted-foreground"
      case "training":
        return "bg-warning text-warning-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }

  const handleTestCall = async () => {
    if (!selectedAgent || !phoneNumber) {
      toast({
        title: "Error",
        description: "Please select an agent and enter a phone number",
        variant: "destructive"
      })
      return
    }

    try {
      // Mock API call to /api/retell/dial
      console.log("Dialing with agent:", selectedAgent.retellId, "to:", phoneNumber)
      
      toast({
        title: "Test Call Initiated",
        description: `Calling ${phoneNumber} with ${selectedAgent.name}`,
      })
      
      setTestCallOpen(false)
      setPhoneNumber("")
      setSelectedAgent(null)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initiate test call",
        variant: "destructive"
      })
    }
  }

  const handleOpenSettings = (agent: Agent) => {
    setEditingAgent({ ...agent })
    setSettingsOpen(true)
  }

  const handleSaveSettings = () => {
    if (!editingAgent) return

    setAgents(prev => prev.map(agent => 
      agent.id === editingAgent.id ? editingAgent : agent
    ))

    toast({
      title: "Agent Settings Updated",
      description: `Settings for ${editingAgent.name} have been saved`,
    })

    setSettingsOpen(false)
    setEditingAgent(null)
  }

  const handleSetDefault = (agentId: string) => {
    setAgents(prev => prev.map(agent => ({
      ...agent,
      isDefault: agent.id === agentId
    })))
    
    toast({
      title: "Default Agent Updated",
      description: "The default agent has been updated for your organization",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">AI Agents</h2>
          <p className="text-muted-foreground">
            Manage your Retell AI agents and configure settings
          </p>
        </div>
        
        <Dialog open={testCallOpen} onOpenChange={setTestCallOpen}>
          <DialogTrigger asChild>
            <Button>
              <Phone className="h-4 w-4 mr-2" />
              Test Call
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Call</DialogTitle>
              <DialogDescription>
                Place a test call using one of your AI agents
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="agent">Select Agent</Label>
                <Select onValueChange={(value) => setSelectedAgent(agents.find(a => a.id === value) || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.filter(a => a.status === "active").map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name} ({agent.retellId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="+1 (555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setTestCallOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleTestCall}>
                  <Phone className="h-4 w-4 mr-2" />
                  Start Call
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Agent Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agent Settings</DialogTitle>
            <DialogDescription>
              Configure settings for {editingAgent?.name}
            </DialogDescription>
          </DialogHeader>
          
          {editingAgent && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="agent-name">Agent Name</Label>
                  <Input
                    id="agent-name"
                    value={editingAgent.name}
                    onChange={(e) => setEditingAgent({...editingAgent, name: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="retell-id">Retell Agent ID</Label>
                  <Input
                    id="retell-id"
                    value={editingAgent.retellId}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Agent ID cannot be changed
                  </p>
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={editingAgent.status} 
                    onValueChange={(value: "active" | "inactive" | "training") => 
                      setEditingAgent({...editingAgent, status: value})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="training">Training</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* AI Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">AI Configuration</h3>
                
                <div>
                  <Label htmlFor="prompt">System Prompt</Label>
                  <Textarea
                    id="prompt"
                    value={editingAgent.prompt || ""}
                    onChange={(e) => setEditingAgent({...editingAgent, prompt: e.target.value})}
                    rows={4}
                    placeholder="Enter the system prompt for this agent..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="voice">Voice</Label>
                    <Select 
                      value={editingAgent.voice || "alloy"} 
                      onValueChange={(value) => setEditingAgent({...editingAgent, voice: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alloy">Alloy</SelectItem>
                        <SelectItem value="echo">Echo</SelectItem>
                        <SelectItem value="fable">Fable</SelectItem>
                        <SelectItem value="onyx">Onyx</SelectItem>
                        <SelectItem value="nova">Nova</SelectItem>
                        <SelectItem value="shimmer">Shimmer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="language">Language</Label>
                    <Select 
                      value={editingAgent.language || "en"} 
                      onValueChange={(value) => setEditingAgent({...editingAgent, language: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="it">Italian</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="temperature">Temperature</Label>
                    <Input
                      id="temperature"
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={editingAgent.temperature || 0.7}
                      onChange={(e) => setEditingAgent({...editingAgent, temperature: parseFloat(e.target.value)})}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Controls randomness (0-1)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="max-tokens">Max Tokens</Label>
                    <Input
                      id="max-tokens"
                      type="number"
                      min="50"
                      max="500"
                      value={editingAgent.maxTokens || 150}
                      onChange={(e) => setEditingAgent({...editingAgent, maxTokens: parseInt(e.target.value)})}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Maximum response length
                    </p>
                  </div>
                </div>
              </div>

              {/* Call Features */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Call Features</h3>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Call Recording</Label>
                    <p className="text-sm text-muted-foreground">
                      Record all calls for quality and training purposes
                    </p>
                  </div>
                  <Switch
                    checked={editingAgent.enableRecording || false}
                    onCheckedChange={(checked) => setEditingAgent({...editingAgent, enableRecording: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Warm Transfer</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow agent to transfer calls to a human representative
                    </p>
                  </div>
                  <Switch
                    checked={editingAgent.enableTransfer || false}
                    onCheckedChange={(checked) => setEditingAgent({...editingAgent, enableTransfer: checked})}
                  />
                </div>

                {editingAgent.enableTransfer && (
                  <div>
                    <Label htmlFor="transfer-number">Transfer Number</Label>
                    <Input
                      id="transfer-number"
                      value={editingAgent.transferNumber || ""}
                      onChange={(e) => setEditingAgent({...editingAgent, transferNumber: e.target.value})}
                      placeholder="+1 (555) 123-4567"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Phone number to transfer calls to
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveSettings}>
                  Save Settings
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <Card key={agent.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{agent.name}</CardTitle>
                  {agent.isDefault && (
                    <Star className="h-4 w-4 text-warning fill-current" />
                  )}
                </div>
                <Badge className={getStatusColor(agent.status)}>
                  {agent.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground font-mono">
                {agent.retellId}
              </p>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Calls</p>
                  <p className="font-semibold">{agent.calls}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Avg Duration</p>
                  <p className="font-semibold">{formatDuration(agent.avgDuration)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Success Rate</p>
                  <p className="font-semibold">{agent.successRate}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-semibold capitalize">{agent.status}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setSelectedAgent(agent)
                    setTestCallOpen(true)
                  }}
                  disabled={agent.status !== "active"}
                >
                  <Phone className="h-3 w-3 mr-1" />
                  Test
                </Button>
                
                {!agent.isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetDefault(agent.id)}
                  >
                    <Star className="h-3 w-3 mr-1" />
                    Set Default
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleOpenSettings(agent)}
                >
                  <Settings className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Default Agent Info */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Default Agent</p>
              <p className="text-sm text-muted-foreground">
                The agent used for new outreach campaigns by default
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium">
                {agents.find(a => a.isDefault)?.name}
              </p>
              <p className="text-sm text-muted-foreground font-mono">
                {agents.find(a => a.isDefault)?.retellId}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}