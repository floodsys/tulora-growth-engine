import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useRetellAgents } from "@/hooks/useRetellAgents"
import { useEntitlements } from "@/lib/entitlements/ssot"
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { MessageSquare, Phone, Plus, Copy, Eye, Settings, Trash2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface WidgetConfig {
  id: string
  agent_id: string
  widget_type: 'chat' | 'callback'
  public_key: string
  config_data: any
  allowed_domains: string[]
  require_recaptcha: boolean
  is_active: boolean
  created_at: string
}

export function WidgetManagement() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { agents } = useRetellAgents()
  const { organization } = useUserOrganization()
  const { entitlements } = useEntitlements(organization?.id)

  useEffect(() => {
    loadWidgets()
  }, [])

  const loadWidgets = async () => {
    try {
      const { data, error } = await supabase
        .from('widget_configs')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setWidgets((data || []) as WidgetConfig[])
    } catch (error) {
      toast.error("Failed to load widgets")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateWidget = async (data: any) => {
    try {
      const response = await supabase.functions.invoke('widget-config-generate', {
        body: data
      })

      if (response.error) throw response.error

      toast.success("Widget created successfully")
      setIsDialogOpen(false)
      loadWidgets()
    } catch (error) {
      toast.error("Failed to create widget")
    }
  }

  const handleToggleWidget = async (widgetId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('widget_configs')
        .update({ is_active: isActive })
        .eq('id', widgetId)

      if (error) throw error
      
      toast.success(isActive ? "Widget activated" : "Widget deactivated")
      loadWidgets()
    } catch (error) {
      toast.error("Failed to update widget")
    }
  }

  const handleDeleteWidget = async (widgetId: string) => {
    try {
      const { error } = await supabase
        .from('widget_configs')
        .delete()
        .eq('id', widgetId)

      if (error) throw error
      
      toast.success("Widget deleted")
      loadWidgets()
    } catch (error) {
      toast.error("Failed to delete widget")
    }
  }

  const generateEmbedCode = (widget: WidgetConfig) => {
    const config = widget.config_data
    const baseUrl = window.location.origin

    if (widget.widget_type === 'chat') {
      return `<!-- Retell AI Chat Widget -->
<div id="retell-chat-widget"></div>
<script>
  (function() {
    const script = document.createElement('script');
    script.src = '${baseUrl}/widget/chat.js';
    script.onload = function() {
      RetellChatWidget.init({
        publicKey: '${widget.public_key}',
        agentId: '${widget.agent_id}',
        position: '${config.position || 'bottom-right'}',
        primaryColor: '${config.primaryColor || '#007bff'}',
        greeting: '${config.greeting || 'Hello! How can I help you?'}',
        placeholder: '${config.placeholder || 'Type your message...'}',
        requireRecaptcha: ${widget.require_recaptcha}
      });
    };
    document.head.appendChild(script);
  })();
</script>`
    } else {
      return `<!-- Retell AI Callback Widget -->
<div id="retell-callback-widget"></div>
<script>
  (function() {
    const script = document.createElement('script');
    script.src = '${baseUrl}/widget/callback.js';
    script.onload = function() {
      RetellCallbackWidget.init({
        publicKey: '${widget.public_key}',
        agentId: '${widget.agent_id}',
        buttonText: '${config.buttonText || 'Request Callback'}',
        primaryColor: '${config.primaryColor || '#007bff'}',
        requireRecaptcha: ${widget.require_recaptcha}
      });
    };
    document.head.appendChild(script);
  })();
</script>`
    }
  }

  const copyEmbedCode = (widget: WidgetConfig) => {
    const code = generateEmbedCode(widget)
    navigator.clipboard.writeText(code)
    toast.success("Embed code copied to clipboard")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Website Widgets</h2>
          <p className="text-muted-foreground">
            Create embeddable chat and callback widgets for your website
          </p>
        </div>
        
        {!entitlements.features.widgets ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">
              Widget features not available on your current plan.
            </p>
            <p className="text-xs text-muted-foreground">
              Upgrade to unlock website widgets
            </p>
          </div>
        ) : entitlements.limits.widgets === null || widgets.length < entitlements.limits.widgets ? (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Widget
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Widget</DialogTitle>
                <DialogDescription>
                  Configure a new chat or callback widget for your website
                </DialogDescription>
              </DialogHeader>
              <CreateWidgetForm agents={agents} onSubmit={handleCreateWidget} />
            </DialogContent>
          </Dialog>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button disabled>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Widget
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Widget limit reached ({entitlements.limits.widgets}). Upgrade to create more widgets.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8">Loading widgets...</div>
      ) : widgets.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No widgets created</h3>
              <p className="text-muted-foreground mb-4">
                Create a widget to embed on your website
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                Create Widget
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {widgets.map((widget) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              agents={agents}
              onToggle={handleToggleWidget}
              onDelete={handleDeleteWidget}
              onCopyEmbed={copyEmbedCode}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CreateWidgetForm({ agents, onSubmit }: { agents: any[], onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    agent_id: "",
    widget_type: "chat" as "chat" | "callback",
    allowed_domains: "",
    require_recaptcha: false,
    config: {
      position: "bottom-right",
      primaryColor: "#007bff",
      greeting: "Hello! How can I help you?",
      placeholder: "Type your message...",
      buttonText: "Request Callback"
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const submitData = {
      ...formData,
      allowed_domains: formData.allowed_domains.split(',').map(d => d.trim()).filter(d => d),
      config_data: formData.config
    }
    
    onSubmit(submitData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="agent">Agent</Label>
          <Select
            value={formData.agent_id}
            onValueChange={(value) => setFormData(prev => ({ ...prev, agent_id: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.retell_agent_id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="type">Widget Type</Label>
          <Select
            value={formData.widget_type}
            onValueChange={(value: "chat" | "callback") => setFormData(prev => ({ ...prev, widget_type: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="chat">Chat Widget</SelectItem>
              <SelectItem value="callback">Callback Widget</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="domains">Allowed Domains</Label>
        <Input
          id="domains"
          placeholder="example.com, www.example.com"
          value={formData.allowed_domains}
          onChange={(e) => setFormData(prev => ({ ...prev, allowed_domains: e.target.value }))}
        />
        <p className="text-sm text-muted-foreground">
          Comma-separated list. Leave empty to allow all domains.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Appearance</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="primaryColor">Primary Color</Label>
            <Input
              id="primaryColor"
              type="color"
              value={formData.config.primaryColor}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                config: { ...prev.config, primaryColor: e.target.value }
              }))}
            />
          </div>
          
          {formData.widget_type === 'chat' && (
            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Select
                value={formData.config.position}
                onValueChange={(value) => setFormData(prev => ({
                  ...prev,
                  config: { ...prev.config, position: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {formData.widget_type === 'chat' ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="greeting">Greeting Message</Label>
              <Input
                id="greeting"
                value={formData.config.greeting}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  config: { ...prev.config, greeting: e.target.value }
                }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="placeholder">Input Placeholder</Label>
              <Input
                id="placeholder"
                value={formData.config.placeholder}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  config: { ...prev.config, placeholder: e.target.value }
                }))}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="buttonText">Button Text</Label>
            <Input
              id="buttonText"
              value={formData.config.buttonText}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                config: { ...prev.config, buttonText: e.target.value }
              }))}
            />
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="recaptcha"
          checked={formData.require_recaptcha}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, require_recaptcha: checked }))}
        />
        <Label htmlFor="recaptcha">Require reCAPTCHA</Label>
      </div>

      <Button type="submit" className="w-full">
        Create Widget
      </Button>
    </form>
  )
}

function WidgetCard({ widget, agents, onToggle, onDelete, onCopyEmbed }: any) {
  const agent = agents.find((a: any) => a.retell_agent_id === widget.agent_id)
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {widget.widget_type === 'chat' ? (
                <MessageSquare className="h-5 w-5" />
              ) : (
                <Phone className="h-5 w-5" />
              )}
              {widget.widget_type === 'chat' ? 'Chat Widget' : 'Callback Widget'}
            </CardTitle>
            <CardDescription>
              Agent: {agent?.name || 'Unknown'} • 
              {widget.is_active ? ' Active' : ' Inactive'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={widget.is_active}
              onCheckedChange={(checked) => onToggle(widget.id, checked)}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCopyEmbed(widget)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(widget.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Public Key</Label>
            <p className="text-sm text-muted-foreground font-mono">{widget.public_key}</p>
          </div>
          <div>
            <Label className="text-sm font-medium">Allowed Domains</Label>
            <p className="text-sm text-muted-foreground">
              {widget.allowed_domains.length > 0 ? widget.allowed_domains.join(', ') : 'All domains'}
            </p>
          </div>
        </div>
        
        {widget.require_recaptcha && (
          <Badge variant="secondary">reCAPTCHA Required</Badge>
        )}
      </CardContent>
    </Card>
  )
}