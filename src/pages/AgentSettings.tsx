import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Save, Bot } from "lucide-react"
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

const AgentSettings = () => {
  const { agentId } = useParams<{ agentId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Find agent by ID (in real app, this would be an API call)
    const foundAgent = mockAgents.find(a => a.id === agentId)
    if (foundAgent) {
      setAgent({ ...foundAgent })
    } else {
      toast({
        title: "Agent Not Found",
        description: "The requested agent could not be found.",
        variant: "destructive"
      })
      navigate("/dashboard")
    }
  }, [agentId, navigate, toast])

  const handleSave = async () => {
    if (!agent) return

    setIsLoading(true)
    try {
      // Mock API call - in real app, this would update the agent via API
      await new Promise(resolve => setTimeout(resolve, 1000))

      toast({
        title: "Agent Settings Updated",
        description: `Settings for ${agent.name} have been saved successfully.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save agent settings. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading agent settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="icon"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Agent Settings</h1>
          <p className="text-muted-foreground">
            Configure settings for {agent.name}
          </p>
        </div>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="agent-name">Agent Name</Label>
              <Input
                id="agent-name"
                value={agent.name}
                onChange={(e) => setAgent({...agent, name: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="retell-id">Retell Agent ID</Label>
              <Input
                id="retell-id"
                value={agent.retellId}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Agent ID cannot be changed
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select 
              value={agent.status} 
              onValueChange={(value: "active" | "inactive" | "training") => 
                setAgent({...agent, status: value})
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
        </CardContent>
      </Card>

      {/* AI Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>AI Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="prompt">System Prompt</Label>
            <Textarea
              id="prompt"
              value={agent.prompt || ""}
              onChange={(e) => setAgent({...agent, prompt: e.target.value})}
              rows={6}
              placeholder="Enter the system prompt for this agent..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="voice">Voice</Label>
              <Select 
                value={agent.voice || "alloy"} 
                onValueChange={(value) => setAgent({...agent, voice: value})}
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
                value={agent.language || "en"} 
                onValueChange={(value) => setAgent({...agent, language: value})}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="temperature">Temperature</Label>
              <Input
                id="temperature"
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={agent.temperature || 0.7}
                onChange={(e) => setAgent({...agent, temperature: parseFloat(e.target.value)})}
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
                value={agent.maxTokens || 150}
                onChange={(e) => setAgent({...agent, maxTokens: parseInt(e.target.value)})}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum response length
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call Features */}
      <Card>
        <CardHeader>
          <CardTitle>Call Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Call Recording</Label>
              <p className="text-sm text-muted-foreground">
                Record all calls for quality and training purposes
              </p>
            </div>
            <Switch
              checked={agent.enableRecording || false}
              onCheckedChange={(checked) => setAgent({...agent, enableRecording: checked})}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Warm Transfer</Label>
              <p className="text-sm text-muted-foreground">
                Allow agent to transfer calls to a human representative
              </p>
            </div>
            <Switch
              checked={agent.enableTransfer || false}
              onCheckedChange={(checked) => setAgent({...agent, enableTransfer: checked})}
            />
          </div>

          {agent.enableTransfer && (
            <div>
              <Label htmlFor="transfer-number">Transfer Number</Label>
              <Input
                id="transfer-number"
                value={agent.transferNumber || ""}
                onChange={(e) => setAgent({...agent, transferNumber: e.target.value})}
                placeholder="+1 (555) 123-4567"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Phone number to transfer calls to
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Organization Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Default Agent</Label>
              <p className="text-sm text-muted-foreground">
                Set this agent as the default for new conversations
              </p>
            </div>
            <Switch
              checked={agent.isDefault || false}
              onCheckedChange={(checked) => setAgent({...agent, isDefault: checked})}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AgentSettings