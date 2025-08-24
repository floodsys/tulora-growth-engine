import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { 
  Bot, 
  Phone, 
  Users, 
  Calendar,
  Settings,
  Save,
  Eye,
  Edit3,
  AlertCircle,
  CheckCircle,
  Clock
} from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"

interface AgentTemplate {
  id: string
  type: 'ai_lead_gen' | 'ai_phone_support'
  name: string
  description: string
  isActive: boolean
  defaultPrompt: string
  defaultVoice: string
  defaultLanguage: string
  defaultMaxTokens: number
  defaultTemperature: number
  typeSpecificDefaults: any
  orgSpecificInputs: string[]
  requiredPlanFeatures: string[]
  createdAt: string
  updatedAt: string
}

const AGENT_TYPES = {
  ai_lead_gen: {
    name: 'AI Lead Gen',
    icon: Users,
    description: 'AI agents specialized in lead generation and qualification',
    color: 'bg-blue-100 text-blue-800',
    defaults: {
      greetingStyle: 'professional_warm',
      qualificationRubric: 'budget_authority_need_timeline',
      bookingHandoff: 'calendar_integration',
      operatingHours: '9am-5pm_business_days',
      complianceDisclaimer: 'This call may be recorded for quality purposes.'
    },
    orgInputs: [
      'phone_number_mapping',
      'crm_webhook_url',
      'calendar_settings',
      'qualification_criteria',
      'booking_flow_url'
    ]
  },
  ai_phone_support: {
    name: 'AI Phone Support',
    icon: Phone,
    description: 'AI agents for customer support and service',
    color: 'bg-green-100 text-green-800',
    defaults: {
      callTriageTree: 'issue_severity_routing',
      escalationPolicy: 'human_after_3_attempts',
      businessHours: '24_7_coverage',
      fallbackToHuman: 'complex_technical_issues',
      complianceDisclaimer: 'This call may be recorded and monitored for training purposes.'
    },
    orgInputs: [
      'knowledge_sources',
      'ticketing_integration',
      'voicemail_policy',
      'escalation_contacts',
      'support_categories'
    ]
  }
} as const

const mockTemplates: AgentTemplate[] = [
  {
    id: '1',
    type: 'ai_lead_gen',
    name: 'Sales Lead Qualifier',
    description: 'Qualifies leads through BANT methodology and books qualified meetings',
    isActive: true,
    defaultPrompt: 'You are a professional sales assistant specializing in lead qualification. Use the BANT methodology (Budget, Authority, Need, Timeline) to qualify prospects. Be friendly, professional, and focus on understanding their business needs.',
    defaultVoice: 'alloy',
    defaultLanguage: 'en',
    defaultMaxTokens: 1000,
    defaultTemperature: 0.7,
    typeSpecificDefaults: AGENT_TYPES.ai_lead_gen.defaults,
    orgSpecificInputs: [...AGENT_TYPES.ai_lead_gen.orgInputs],
    requiredPlanFeatures: ['basic_calendar'],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z'
  },
  {
    id: '2',
    type: 'ai_phone_support',
    name: 'Customer Support Agent',
    description: 'Handles customer inquiries, troubleshooting, and escalations',
    isActive: true,
    defaultPrompt: 'You are a helpful customer support representative. Listen carefully to customer issues, ask clarifying questions, and provide clear solutions. Escalate to human agents when necessary.',
    defaultVoice: 'echo',
    defaultLanguage: 'en',
    defaultMaxTokens: 1500,
    defaultTemperature: 0.5,
    typeSpecificDefaults: AGENT_TYPES.ai_phone_support.defaults,
    orgSpecificInputs: [...AGENT_TYPES.ai_phone_support.orgInputs],
    requiredPlanFeatures: ['email_support'],
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-22T09:15:00Z'
  }
]

export function AgentCatalogAdmin() {
  const [templates, setTemplates] = useState<AgentTemplate[]>(mockTemplates)
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSaveTemplate = async (template: AgentTemplate) => {
    setLoading(true)
    try {
      // In real implementation, this would save to database
      setTemplates(prev => 
        prev.map(t => t.id === template.id ? { ...template, updatedAt: new Date().toISOString() } : t)
      )
      
      toast({
        title: "Template Updated",
        description: "Agent template has been successfully updated.",
      })
      
      setEditDialogOpen(false)
      setSelectedTemplate(null)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update template. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (templateId: string) => {
    try {
      setTemplates(prev =>
        prev.map(t => t.id === templateId ? { ...t, isActive: !t.isActive } : t)
      )
      
      toast({
        title: "Template Status Updated",
        description: "Template availability has been updated.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update template status.",
        variant: "destructive"
      })
    }
  }

  const EditTemplateDialog = ({ template, open, onOpenChange }: {
    template: AgentTemplate | null
    open: boolean
    onOpenChange: (open: boolean) => void
  }) => {
    const [editedTemplate, setEditedTemplate] = useState<AgentTemplate | null>(template)

    useEffect(() => {
      setEditedTemplate(template)
    }, [template])

    if (!editedTemplate) return null

    const agentType = AGENT_TYPES[editedTemplate.type]

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <agentType.icon className="h-5 w-5" />
              Edit {agentType.name} Template
            </DialogTitle>
            <DialogDescription>
              Update the default configuration for {agentType.name} agents
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={editedTemplate.name}
                  onChange={(e) => setEditedTemplate(prev => prev ? { ...prev, name: e.target.value } : null)}
                />
              </div>
              <div>
                <Label htmlFor="voice">Default Voice</Label>
                <Select 
                  value={editedTemplate.defaultVoice} 
                  onValueChange={(value) => setEditedTemplate(prev => prev ? { ...prev, defaultVoice: value } : null)}
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
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editedTemplate.description}
                onChange={(e) => setEditedTemplate(prev => prev ? { ...prev, description: e.target.value } : null)}
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="prompt">Default System Prompt</Label>
              <Textarea
                id="prompt"
                value={editedTemplate.defaultPrompt}
                onChange={(e) => setEditedTemplate(prev => prev ? { ...prev, defaultPrompt: e.target.value } : null)}
                rows={4}
                placeholder="Enter the default system prompt for this agent type..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  value={editedTemplate.defaultMaxTokens}
                  onChange={(e) => setEditedTemplate(prev => prev ? { ...prev, defaultMaxTokens: parseInt(e.target.value) || 1000 } : null)}
                />
              </div>
              <div>
                <Label htmlFor="temperature">Temperature</Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={editedTemplate.defaultTemperature}
                  onChange={(e) => setEditedTemplate(prev => prev ? { ...prev, defaultTemperature: parseFloat(e.target.value) || 0.7 } : null)}
                />
              </div>
              <div>
                <Label htmlFor="language">Language</Label>
                <Select 
                  value={editedTemplate.defaultLanguage} 
                  onValueChange={(value) => setEditedTemplate(prev => prev ? { ...prev, defaultLanguage: value } : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-3">Type-Specific Defaults</h4>
              <div className="space-y-3">
                {Object.entries(agentType.defaults).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <div className="font-medium capitalize">{key.replace(/_/g, ' ')}</div>
                      <div className="text-sm text-muted-foreground">{value}</div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-3">Organization Input Fields</h4>
              <div className="grid grid-cols-2 gap-2">
                {agentType.orgInputs.map((input) => (
                  <div key={input} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="text-sm capitalize">{input.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => handleSaveTemplate(editedTemplate)} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Save Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Agent Catalog</h2>
          <p className="text-muted-foreground">
            Manage the two available agent types that organizations can provision
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {templates.map((template) => {
          const agentType = AGENT_TYPES[template.type]
          const IconComponent = agentType.icon

          return (
            <Card key={template.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${agentType.color}`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">{template.name}</CardTitle>
                        <Badge variant={template.isActive ? "default" : "secondary"}>
                          {template.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <CardDescription className="max-w-2xl">
                        {template.description}
                      </CardDescription>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                        <span>Voice: {template.defaultVoice}</span>
                        <span>•</span>
                        <span>Max Tokens: {template.defaultMaxTokens}</span>
                        <span>•</span>
                        <span>Temperature: {template.defaultTemperature}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={template.isActive}
                      onCheckedChange={() => handleToggleActive(template.id)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTemplate(template)
                        setEditDialogOpen(true)
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Default Configuration
                    </h4>
                    <div className="space-y-2 text-sm">
                      {Object.entries(agentType.defaults).slice(0, 3).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Organization Inputs ({agentType.orgInputs.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {agentType.orgInputs.slice(0, 3).map((input) => (
                        <Badge key={input} variant="outline" className="text-xs">
                          {input.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                      {agentType.orgInputs.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{agentType.orgInputs.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <EditTemplateDialog
        template={selectedTemplate}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  )
}