import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Copy, ExternalLink, Code, Settings } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface WidgetEmbedGeneratorProps {
  agent: {
    agent_id: string
    name: string
    status: string
  }
  organizationId?: string
}

export function WidgetEmbedGenerator({ agent, organizationId }: WidgetEmbedGeneratorProps) {
  const [config, setConfig] = useState({
    widget_type: 'chat',
    position: 'bottom-right',
    theme: 'light',
    primary_color: '#3b82f6',
    show_agent_name: true,
    show_powered_by: true,
    custom_greeting: '',
    allowed_domains: '',
    require_recaptcha: false,
    auto_open: false,
    floating_button: true,
  })
  const { toast } = useToast()

  const generatePublicKey = () => {
    return `pk_${organizationId}_${agent.agent_id.slice(-8)}`
  }

  const generateEmbedCode = () => {
    const publicKey = generatePublicKey()
    const domainRestriction = config.allowed_domains 
      ? `data-allowed-domains="${config.allowed_domains}"` 
      : ''
    
    const chatWidget = `<!-- Retell AI Chat Widget -->
<script>
  window.RetellConfig = {
    publicKey: "${publicKey}",
    agentId: "${agent.agent_id}",
    theme: "${config.theme}",
    position: "${config.position}",
    primaryColor: "${config.primary_color}",
    showAgentName: ${config.show_agent_name},
    showPoweredBy: ${config.show_powered_by},
    customGreeting: "${config.custom_greeting}",
    autoOpen: ${config.auto_open},
    floatingButton: ${config.floating_button},
    requireRecaptcha: ${config.require_recaptcha}
  };
</script>
<script 
  src="https://widget.retellai.com/chat.js" 
  ${domainRestriction}
  async
></script>`

    const callbackWidget = `<!-- Retell AI Callback Widget -->
<div id="retell-callback-widget" 
     data-agent-id="${agent.agent_id}"
     data-public-key="${publicKey}"
     data-theme="${config.theme}"
     ${domainRestriction}
></div>
<script src="https://widget.retellai.com/callback.js" async></script>`

    return config.widget_type === 'chat' ? chatWidget : callbackWidget
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generateEmbedCode())
      toast({
        title: "Code copied",
        description: "Widget embed code copied to clipboard",
      })
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the code manually",
        variant: "destructive"
      })
    }
  }

  const getPreviewUrl = () => {
    const publicKey = generatePublicKey()
    const params = new URLSearchParams({
      agent: agent.agent_id,
      pk: publicKey,
      theme: config.theme,
      type: config.widget_type,
    })
    return `https://widget.retellai.com/preview?${params.toString()}`
  }

  if (agent.status !== 'published') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <Code className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Widget Not Available</h3>
            <p className="text-muted-foreground mb-4">
              Agent must be published before generating embed widgets
            </p>
            <Badge variant="secondary">
              Requires published agent
            </Badge>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Widget Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Widget Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="widget_type">Widget Type</Label>
              <Select
                value={config.widget_type}
                onValueChange={(value) => setConfig({ ...config, widget_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chat">Chat Widget</SelectItem>
                  <SelectItem value="callback">Callback Form</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Select
                value={config.position}
                onValueChange={(value) => setConfig({ ...config, position: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                  <SelectItem value="top-right">Top Right</SelectItem>
                  <SelectItem value="top-left">Top Left</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select
                value={config.theme}
                onValueChange={(value) => setConfig({ ...config, theme: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="primary_color">Primary Color</Label>
              <Input
                id="primary_color"
                type="color"
                value={config.primary_color}
                onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom_greeting">Custom Greeting</Label>
            <Input
              id="custom_greeting"
              placeholder="Hi! How can I help you today?"
              value={config.custom_greeting}
              onChange={(e) => setConfig({ ...config, custom_greeting: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="allowed_domains">Allowed Domains (Security)</Label>
            <Input
              id="allowed_domains"
              placeholder="yourdomain.com, app.yourdomain.com"
              value={config.allowed_domains}
              onChange={(e) => setConfig({ ...config, allowed_domains: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              Restrict widget to specific domains for security
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="show_agent_name">Show Agent Name</Label>
              <Switch
                id="show_agent_name"
                checked={config.show_agent_name}
                onCheckedChange={(checked) => setConfig({ ...config, show_agent_name: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="auto_open">Auto Open</Label>
              <Switch
                id="auto_open"
                checked={config.auto_open}
                onCheckedChange={(checked) => setConfig({ ...config, auto_open: checked })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="require_recaptcha">Require reCAPTCHA</Label>
              <Switch
                id="require_recaptcha"
                checked={config.require_recaptcha}
                onCheckedChange={(checked) => setConfig({ ...config, require_recaptcha: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="floating_button">Floating Button</Label>
              <Switch
                id="floating_button"
                checked={config.floating_button}
                onCheckedChange={(checked) => setConfig({ ...config, floating_button: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generated Embed Code */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Embed Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="embed_code">HTML Embed Code</Label>
            <Textarea
              id="embed_code"
              className="font-mono text-sm min-h-[200px]"
              value={generateEmbedCode()}
              readOnly
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCopyCode} className="flex-1">
              <Copy className="h-4 w-4 mr-2" />
              Copy Code
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.open(getPreviewUrl(), '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Public Key:</p>
            <code className="bg-muted px-2 py-1 rounded">{generatePublicKey()}</code>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}