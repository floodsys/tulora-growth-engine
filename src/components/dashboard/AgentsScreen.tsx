import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Bot, Phone, Star, Play, Pause, Settings, Plus, BarChart3, FileText, Zap, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { useRetellAnalytics } from "@/hooks/useRetellAnalytics"
import { AgentCatalog } from "@/components/AgentCatalog"

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

const AllAgentsTab = () => {
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
    // Use the new agent settings page
    navigate(`/agent/${agent.id}/settings`)
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
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>AI Agents</CardTitle>
            </div>
            <div className="flex gap-2">
              <Dialog open={testCallOpen} onOpenChange={setTestCallOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
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
              
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>
                      <Bot className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{agent.name}</h3>
                      {agent.isDefault && (
                        <Star className="h-4 w-4 text-warning fill-current" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge className={getStatusColor(agent.status)}>
                        {agent.status}
                      </Badge>
                      <span>•</span>
                      <span>{agent.calls} calls</span>
                      <span>•</span>
                      <span>{agent.successRate}% success rate</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    {agent.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleOpenSettings(agent)}>
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const PerformanceTab = () => {
  const { organization } = useUserOrganization()
  const { analytics, loading, getByAgent } = useRetellAnalytics(organization?.id)
  const { dateRange } = useDashboardDateRange()
  const [agentPerformance, setAgentPerformance] = useState<any[]>([])
  const [perfLoading, setPerfLoading] = useState(false)

  // Load agent performance data
  useEffect(() => {
    const loadAgentPerformance = async () => {
      if (!organization?.id) return
      
      setPerfLoading(true)
      try {
        const dateFilter = dateRange?.from && dateRange?.to ? {
          start: dateRange.from.toISOString(),
          end: dateRange.to.toISOString()
        } : undefined
        
        const agentData = await getByAgent(dateFilter)
        setAgentPerformance(agentData)
      } catch (error) {
        console.error('Error loading agent performance:', error)
      } finally {
        setPerfLoading(false)
      }
    }

    loadAgentPerformance()
  }, [organization?.id, dateRange, getByAgent])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-24 animate-pulse"></div>
                <div className="h-4 w-4 bg-muted rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16 mb-2 animate-pulse"></div>
                <div className="h-3 bg-muted rounded w-32 animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Analytics Data</h3>
              <p className="text-muted-foreground">
                Performance metrics will appear here once you have call data
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total_calls}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.successful_calls} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.completion_rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Call success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.floor(analytics.average_duration / 60)}m</div>
            <p className="text-xs text-muted-foreground">
              {analytics.average_duration % 60}s average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positive Sentiment</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.sentiment_breakdown.positive}</div>
            <p className="text-xs text-muted-foreground">
              calls with positive tone
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance Table */}
      {(analytics?.agent_performance.length > 0 || agentPerformance.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(agentPerformance.length > 0 ? agentPerformance : analytics?.agent_performance || []).map(agent => (
                <div key={agent.agent_id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Bot className="h-8 w-8 text-primary" />
                    <div>
                      <h4 className="font-medium">{agent.agent_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {agent.call_count} calls • {agent.success_rate.toFixed(1)}% success
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{Math.floor(agent.avg_duration / 60)}m {agent.avg_duration % 60}s</div>
                    <div className="text-xs text-muted-foreground">avg duration</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Peak Hours */}
      {analytics.peak_hours.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Peak Call Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {analytics.peak_hours.map(({ hour, count }) => (
                <div key={hour} className="text-center">
                  <div className="text-lg font-bold">{count}</div>
                  <div className="text-sm text-muted-foreground">
                    {hour}:00
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const TemplatesTab = () => {
  const { organization } = useUserOrganization()
  
  return (
    <div className="space-y-6">
      <AgentCatalog onAgentCreated={() => window.location.reload()} />
    </div>
  )
}

const AutomationTab = () => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Agent Automation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Automated agent workflows and triggers coming soon...</p>
      </CardContent>
    </Card>
  </div>
)

export function AgentsScreen() {
  return (
    <div className="h-full max-h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">AI Agents</h1>
        <p className="text-muted-foreground">Create and manage your AI voice agents</p>
      </div>
      
      <Tabs defaultValue="agents" className="h-full flex flex-col">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="agents">AGENTS</TabsTrigger>
          <TabsTrigger value="performance">PERFORMANCE</TabsTrigger>
          <TabsTrigger value="templates">TEMPLATES</TabsTrigger>
          <TabsTrigger value="automation">AUTOMATION</TabsTrigger>
        </TabsList>
        
        <TabsContent value="agents" className="flex-1 mt-6">
          <AllAgentsTab />
        </TabsContent>
        
        <TabsContent value="performance" className="flex-1 mt-6">
          <PerformanceTab />
        </TabsContent>
        
        <TabsContent value="templates" className="flex-1 mt-6">
          <TemplatesTab />
        </TabsContent>
        
        <TabsContent value="automation" className="flex-1 mt-6">
          <AutomationTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}