import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Bot, 
  Phone, 
  Users, 
  Calendar,
  Settings,
  Plus,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Crown,
  Lock
} from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/AuthContext"
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { useOrgFeatureFlags } from "@/lib/feature-gating"
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
}

interface ProvisioningFormData {
  name: string
  phoneNumberMapping?: string
  crmWebhookUrl?: string
  calendarSettings?: string
  qualificationCriteria?: string
  knowledgeSources?: string
  ticketingIntegration?: string
  voicemailPolicy?: string
  escalationContacts?: string
  supportCategories?: string
}

const AGENT_TYPES = {
  ai_lead_gen: {
    name: 'AI Lead Gen',
    icon: Users,
    description: 'AI agents specialized in lead generation and qualification',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    accentColor: 'border-blue-200 dark:border-blue-800',
    benefits: [
      'Qualify leads 24/7 using BANT methodology',
      'Schedule qualified meetings automatically',
      'Integrate with your CRM and calendar',
      'Track conversion rates and lead quality'
    ],
    orgInputs: {
      phoneNumberMapping: { label: 'Phone Number Mapping', required: true, placeholder: '+1-555-SALES-01' },
      crmWebhookUrl: { label: 'CRM Webhook URL', required: false, placeholder: 'https://your-crm.com/webhook' },
      calendarSettings: { label: 'Calendar Integration', required: true, placeholder: 'Calendly/HubSpot calendar link' },
      qualificationCriteria: { label: 'Qualification Criteria', required: false, placeholder: 'Budget > $1000, Authority confirmed...' }
    }
  },
  ai_phone_support: {
    name: 'AI Phone Support',
    icon: Phone,
    description: 'AI agents for customer support and service',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    accentColor: 'border-green-200 dark:border-green-800',
    benefits: [
      'Handle customer inquiries 24/7',
      'Escalate complex issues to humans',
      'Access knowledge base for accurate answers',
      'Integrate with your ticketing system'
    ],
    orgInputs: {
      knowledgeSources: { label: 'Knowledge Sources', required: true, placeholder: 'Upload documentation, FAQs, manuals...' },
      ticketingIntegration: { label: 'Ticketing Integration', required: false, placeholder: 'Zendesk, Freshdesk, ServiceNow...' },
      voicemailPolicy: { label: 'Voicemail Policy', required: false, placeholder: 'After hours behavior, callback options...' },
      escalationContacts: { label: 'Escalation Contacts', required: true, placeholder: '+1-555-SUPPORT, support@company.com' },
      supportCategories: { label: 'Support Categories', required: false, placeholder: 'Technical, Billing, General...' }
    }
  }
} as const

const mockTemplates: AgentTemplate[] = [
  {
    id: '1',
    type: 'ai_lead_gen',
    name: 'Sales Lead Qualifier',
    description: 'Qualifies leads through BANT methodology and schedules qualified meetings with your sales team.',
    isActive: true,
    defaultPrompt: 'You are a professional sales assistant specializing in lead qualification. Use the BANT methodology (Budget, Authority, Need, Timeline) to qualify prospects. Be friendly, professional, and focus on understanding their business needs.',
    defaultVoice: 'alloy',
    defaultLanguage: 'en',
    defaultMaxTokens: 1000,
    defaultTemperature: 0.7,
    typeSpecificDefaults: {},
    orgSpecificInputs: Object.keys(AGENT_TYPES.ai_lead_gen.orgInputs),
    requiredPlanFeatures: ['basic_calendar']
  },
  {
    id: '2',
    type: 'ai_phone_support',
    name: 'Customer Support Agent',
    description: 'Handles customer inquiries, troubleshooting, and escalations with access to your knowledge base.',
    isActive: true,
    defaultPrompt: 'You are a helpful customer support representative. Listen carefully to customer issues, ask clarifying questions, and provide clear solutions. Escalate to human agents when necessary.',
    defaultVoice: 'echo',
    defaultLanguage: 'en',
    defaultMaxTokens: 1500,
    defaultTemperature: 0.5,
    typeSpecificDefaults: {},
    orgSpecificInputs: Object.keys(AGENT_TYPES.ai_phone_support.orgInputs),
    requiredPlanFeatures: ['email_support']
  }
]

interface AgentCatalogProps {
  onAgentCreated?: () => void
}

export function AgentCatalog({ onAgentCreated }: AgentCatalogProps) {
  const { user } = useAuth()
  const { organization } = useUserOrganization()
  const { flags } = useOrgFeatureFlags(organization?.id || null)
  
  const [templates] = useState<AgentTemplate[]>(mockTemplates)
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null)
  const [provisioningOpen, setProvisioningOpen] = useState(false)
  const [formData, setFormData] = useState<ProvisioningFormData>({ name: '' })
  const [loading, setLoading] = useState(false)

  const canCreateAgent = flags?.canCreateAgent ?? false
  const hasFeature = (feature: string) => flags?.hasFeature(feature) ?? false

  const handleProvisionAgent = async () => {
    if (!selectedTemplate || !organization) return

    setLoading(true)
    try {
      // Validate required fields
      const agentType = AGENT_TYPES[selectedTemplate.type]
      const requiredFields = Object.entries(agentType.orgInputs)
        .filter(([_, config]) => config.required)
        .map(([key]) => key)

      const missingFields = requiredFields.filter(field => !formData[field as keyof ProvisioningFormData])
      
      if (missingFields.length > 0) {
        const fieldLabels = missingFields.map(f => {
          if (selectedTemplate.type === 'ai_lead_gen') {
            const inputKey = f as keyof typeof AGENT_TYPES.ai_lead_gen.orgInputs
            return AGENT_TYPES.ai_lead_gen.orgInputs[inputKey]?.label || f
          } else {
            const inputKey = f as keyof typeof AGENT_TYPES.ai_phone_support.orgInputs
            return AGENT_TYPES.ai_phone_support.orgInputs[inputKey]?.label || f
          }
        })
        toast({
          title: "Missing Required Fields",
          description: `Please fill in: ${fieldLabels.join(', ')}`,
          variant: "destructive"
        })
        return
      }

      // Create agent with template defaults + org inputs
      const agentData = {
        organization_id: organization.id,
        name: formData.name,
        system_prompt: selectedTemplate.defaultPrompt,
        voice: selectedTemplate.defaultVoice,
        language: selectedTemplate.defaultLanguage,
        max_tokens: selectedTemplate.defaultMaxTokens,
        temperature: selectedTemplate.defaultTemperature,
        status: 'draft',
        first_message_mode: 'assistant_speaks',
        first_message: `Hello! I'm your ${agentType.name.toLowerCase()} assistant. How can I help you today?`,
        retell_agent_id: `temp_${Date.now()}`, // Temporary until Retell integration
        is_default: false,
        warm_transfer_enabled: false,
        call_recording_enabled: true,
        settings: {
          agent_type: selectedTemplate.type,
          template_id: selectedTemplate.id,
          org_specific_config: formData as Record<string, any>,
          created_from_catalog: true
        }
      }

      const { data, error } = await supabase
        .from('agent_profiles')
        .insert([agentData])
        .select()
        .single()

      if (error) throw error

      toast({
        title: "Agent Created Successfully",
        description: `${formData.name} has been created in draft mode. You can now configure and publish it.`,
      })

      setProvisioningOpen(false)
      setSelectedTemplate(null)
      setFormData({ name: '' })
      onAgentCreated?.()

    } catch (error) {
      console.error('Error creating agent:', error)
      toast({
        title: "Error Creating Agent",
        description: "Failed to create agent. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const ProvisioningDialog = ({ template, open, onOpenChange }: {
    template: AgentTemplate | null
    open: boolean
    onOpenChange: (open: boolean) => void
  }) => {
    if (!template) return null

    const agentType = AGENT_TYPES[template.type]
    const IconComponent = agentType.icon

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconComponent className="h-5 w-5" />
              Create {agentType.name} Agent
            </DialogTitle>
            <DialogDescription>
              Configure your agent with organization-specific settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <Label htmlFor="agentName">Agent Name *</Label>
              <Input
                id="agentName"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Sales Qualifier Bot"
              />
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-4">Organization-Specific Configuration</h4>
              <div className="space-y-4">
                {Object.entries(agentType.orgInputs).map(([key, config]) => (
                  <div key={key}>
                    <Label htmlFor={key}>
                      {config.label} {config.required && <span className="text-destructive">*</span>}
                    </Label>
                    {key === 'qualificationCriteria' || key === 'knowledgeSources' || key === 'voicemailPolicy' || key === 'supportCategories' ? (
                      <Textarea
                        id={key}
                        value={formData[key as keyof ProvisioningFormData] || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={config.placeholder}
                        rows={3}
                      />
                    ) : (
                      <Input
                        id={key}
                        value={formData[key as keyof ProvisioningFormData] || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={config.placeholder}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold mb-2">What happens next?</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Agent will be created in draft mode</li>
                <li>• You can test and refine the configuration</li>
                <li>• Publish when ready to go live</li>
                <li>• Monitor performance and make adjustments</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleProvisionAgent} disabled={loading || !formData.name}>
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Agent Catalog</h2>
        <p className="text-muted-foreground">
          Choose from our specialized AI agent types to get started quickly
        </p>
      </div>

      {!canCreateAgent && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You've reached your plan limit for agents. 
            <Button variant="link" className="ml-1 p-0 h-auto">
              Upgrade your plan
            </Button> 
            to create more agents.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        {templates.filter(t => t.isActive).map((template) => {
          const agentType = AGENT_TYPES[template.type]
          const IconComponent = agentType.icon
          const hasRequiredFeatures = template.requiredPlanFeatures.every(feature => hasFeature(feature))
          const isAvailable = hasRequiredFeatures && canCreateAgent

          return (
            <Card key={template.id} className={`relative ${agentType.accentColor} border-2`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${agentType.color}`}>
                      <IconComponent className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                      <CardTitle className="text-xl">{template.name}</CardTitle>
                      <CardDescription className="max-w-2xl">
                        {template.description}
                      </CardDescription>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Key Benefits:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {agentType.benefits.map((benefit, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <CheckCircle className="h-3 w-3 text-success" />
                              {benefit}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {!hasRequiredFeatures && (
                      <Badge variant="outline" className="gap-1">
                        <Crown className="h-3 w-3" />
                        Requires {flags?.planName || 'Upgrade'}
                      </Badge>
                    )}
                    <Button
                      onClick={() => {
                        setSelectedTemplate(template)
                        setFormData({ name: `${template.name} - ${organization?.name || 'My'}` })
                        setProvisioningOpen(true)
                      }}
                      disabled={!isAvailable}
                      className="gap-2"
                    >
                      {!isAvailable && <Lock className="h-4 w-4" />}
                      {isAvailable ? 'Create Agent' : 'Upgrade Required'}
                      {isAvailable && <ArrowRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div>
                  <h4 className="font-semibold mb-3 text-sm">Configuration Fields ({Object.keys(agentType.orgInputs).length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(agentType.orgInputs).map(([key, config]) => (
                      <Badge key={key} variant="outline" className="text-xs">
                        {config.label}
                        {config.required && <span className="text-destructive ml-1">*</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <ProvisioningDialog
        template={selectedTemplate}
        open={provisioningOpen}
        onOpenChange={setProvisioningOpen}
      />
    </div>
  )
}