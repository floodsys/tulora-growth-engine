import { useState } from "react"
import { useNavigate } from "react-router-dom"
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
import { Bot, Phone, Star, Play, Pause, Settings, Plus, BarChart3, FileText, Zap, MessageSquare } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { useRetellAgents } from "@/hooks/useRetellAgents"
import { AgentCatalog } from "@/components/AgentCatalog"
import SMSView from "@/components/SMSView"
import { supabase } from "@/integrations/supabase/client"


const AllAgentsTab = () => {
  const navigate = useNavigate()
  const { organization } = useUserOrganization()
  const { agents, loading, updateAgent } = useRetellAgents(organization?.id)
  const [testCallOpen, setTestCallOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<any>(null)
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
      const { data, error } = await supabase.functions.invoke('retell-outbound', {
        body: { 
          agentSlug: selectedAgent.agent_id,
          toNumber: phoneNumber 
        }
      })

      if (error) throw error
      
      toast({
        title: "Test Call Initiated",
        description: `Calling ${phoneNumber} with ${selectedAgent.name}`,
      })
      
      setTestCallOpen(false)
      setPhoneNumber("")
      setSelectedAgent(null)
    } catch (error) {
      console.error('Test call error:', error)
      toast({
        title: "Error",
        description: "Failed to initiate test call",
        variant: "destructive"
      })
    }
  }

  const handleOpenSettings = (agent: any) => {
    console.log('Navigating to Retell agent settings for agent:', agent.id, agent.name)
    navigate(`/retell-agent/${agent.agent_id}`)
  }

  const handleToggleStatus = async (agent: any) => {
    const newStatus = agent.status === 'active' ? 'inactive' : 'active'
    await updateAgent(agent.id, { status: newStatus })
    
    toast({
      title: "Agent Status Updated",
      description: `${agent.name} is now ${newStatus}`,
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>AI Agents</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" disabled>
                  <Phone className="h-4 w-4 mr-2" />
                  Test Call
                </Button>
                <Button disabled>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Agent
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-muted rounded-full" />
                    <div>
                      <div className="h-4 w-32 bg-muted rounded mb-2" />
                      <div className="h-3 w-48 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-muted rounded" />
                    <div className="h-8 w-8 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
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
                  <Button variant="outline" disabled={agents.length === 0}>
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
                              {agent.name} ({agent.agent_id})
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
              
              <Button onClick={() => navigate('/agents/templates')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first AI agent to get started with voice automation
              </p>
              <Button onClick={() => navigate('/agents/templates')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Agent
              </Button>
            </div>
          ) : (
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
                        {agent.is_active && (
                          <Star className="h-4 w-4 text-warning fill-current" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge className={getStatusColor(agent.status)}>
                          {agent.status}
                        </Badge>
                        <span>•</span>
                        <span>ID: {agent.agent_id}</span>
                        {agent.voice_id && (
                          <>
                            <span>•</span>
                            <span>Voice: {agent.voice_id}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleToggleStatus(agent)}
                    >
                      {agent.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleOpenSettings(agent)}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const PerformanceTab = () => {
  const { organization } = useUserOrganization()
  const { agents } = useRetellAgents(organization?.id)
  
  const activeAgents = agents.filter(a => a.status === 'active').length
  const totalAgents = agents.length

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAgents}</div>
            <p className="text-xs text-muted-foreground">{activeAgents} active, {totalAgents - activeAgents} inactive</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Success Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Detailed performance analytics coming soon...</p>
        </CardContent>
      </Card>
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

const SMSTab = () => (
  <div className="space-y-6">
    <SMSView />
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
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          <TabsTrigger value="agents">AGENTS</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="performance">PERFORMANCE</TabsTrigger>
          <TabsTrigger value="templates">TEMPLATES</TabsTrigger>
          <TabsTrigger value="automation">AUTOMATION</TabsTrigger>
        </TabsList>
        
        <TabsContent value="agents" className="flex-1 mt-6">
          <AllAgentsTab />
        </TabsContent>
        
        <TabsContent value="sms" className="flex-1 mt-6">
          <SMSTab />
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