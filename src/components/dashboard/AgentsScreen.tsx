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
import { Bot, Phone, Star } from "lucide-react"
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
    id: "00000000-0000-0000-0000-000000000001",
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
    id: "00000000-0000-0000-0000-000000000002", 
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
    id: "00000000-0000-0000-0000-000000000003",
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
  const navigate = useNavigate()
  const [agents, setAgents] = useState(mockAgents)
  const [testCallOpen, setTestCallOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
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
    console.log('Navigating to agent settings for agent:', agent.id, agent.name)
    navigate(`/app/agents/${agent.id}`)
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


      {/* Agents Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
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
              
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-0"
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
                    className="flex-1 min-w-0"
                  >
                    <Star className="h-3 w-3 mr-1" />
                    Default
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleOpenSettings(agent)}
                  className="flex-1 min-w-0"
                >
                  Edit
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