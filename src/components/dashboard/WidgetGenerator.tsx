import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Code, Copy, Eye, Settings, MessageCircle, Phone } from 'lucide-react'
import { useRetellAgents } from '@/hooks/useRetellAgents'
import { useUserOrganization } from '@/hooks/useUserOrganization'
import { useToast } from '@/hooks/use-toast'

export const WidgetGenerator = () => {
  const { organization } = useUserOrganization()
  const { agents } = useRetellAgents(organization?.id)
  const { toast } = useToast()

  const [selectedAgent, setSelectedAgent] = useState('')
  const [widgetType, setWidgetType] = useState<'chat' | 'callback'>('chat')
  const [widgetTitle, setWidgetTitle] = useState('Chat with us')
  const [widgetDescription, setWidgetDescription] = useState('Ask us anything!')
  const [allowedDomain, setAllowedDomain] = useState('')
  const [widgetPosition, setWidgetPosition] = useState('bottom-right')
  const [widgetColor, setWidgetColor] = useState('#3b82f6')

  const publishedAgents = agents?.filter(agent => agent.status === 'published') || []

  const generateEmbedCode = () => {
    if (!selectedAgent || !allowedDomain) return ''

    const config = {
      agent_id: selectedAgent,
      domain: allowedDomain,
      type: widgetType,
      title: widgetTitle,
      description: widgetDescription,
      position: widgetPosition,
      color: widgetColor,
      organization_id: organization?.id
    }

    const configString = JSON.stringify(config, null, 2)

    return `<!-- Retell AI Widget -->
<div id="retell-widget"></div>
<script>
  (function() {
    const config = ${configString};
    
    const script = document.createElement('script');
    script.src = 'https://cdn.retellai.com/widget/v1/retell-widget.js';
    script.async = true;
    script.onload = function() {
      if (window.RetellWidget) {
        window.RetellWidget.init(config);
      }
    };
    document.head.appendChild(script);
  })();
</script>`
  }

  const handleCopyCode = () => {
    const code = generateEmbedCode()
    navigator.clipboard.writeText(code)
    toast({
      title: "Code copied",
      description: "Widget embed code has been copied to clipboard.",
    })
  }

  const embedCode = generateEmbedCode()

  return (
    <div className="space-y-6">
      {/* Widget Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Widget Configuration
          </CardTitle>
          <CardDescription>
            Configure your website widget settings and generate embed code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={widgetType} onValueChange={(value) => setWidgetType(value as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Chat Widget
              </TabsTrigger>
              <TabsTrigger value="callback" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Callback Widget
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Chat Widget:</strong> Allows visitors to start a real-time conversation with your AI agent.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="callback" className="space-y-4">
              <div className="bg-green-50 p-4 rounded-md">
                <p className="text-sm text-green-800">
                  <strong>Callback Widget:</strong> Collects visitor information and schedules a callback from your AI agent.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="agent">AI Agent</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {publishedAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.agent_id}>
                      <div className="flex items-center gap-2">
                        <span>{agent.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {agent.language}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {publishedAgents.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No published agents available.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Allowed Domain</Label>
              <Input
                id="domain"
                placeholder="example.com"
                value={allowedDomain}
                onChange={(e) => setAllowedDomain(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Widget Title</Label>
              <Input
                id="title"
                value={widgetTitle}
                onChange={(e) => setWidgetTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Select value={widgetPosition} onValueChange={setWidgetPosition}>
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

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Widget Description</Label>
              <Textarea
                id="description"
                value={widgetDescription}
                onChange={(e) => setWidgetDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Widget Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="color"
                  type="color"
                  value={widgetColor}
                  onChange={(e) => setWidgetColor(e.target.value)}
                  className="w-20 h-10"
                />
                <Input
                  value={widgetColor}
                  onChange={(e) => setWidgetColor(e.target.value)}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generated Code */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Generated Embed Code
          </CardTitle>
          <CardDescription>
            Copy this code and paste it into your website's HTML.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedAgent || !allowedDomain ? (
            <div className="text-center py-8 text-muted-foreground">
              Select an agent and enter a domain to generate embed code
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Copy and paste this code before the closing &lt;/body&gt; tag
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCode}
                  className="flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy Code
                </Button>
              </div>

              <div className="relative">
                <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-80">
                  <code>{embedCode}</code>
                </pre>
              </div>

              <div className="bg-orange-50 p-4 rounded-md">
                <p className="text-sm text-orange-800">
                  <strong>Important:</strong> Make sure to add "{allowedDomain}" to your allowed domains 
                  in the Security settings before deploying this widget.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Widget Preview
          </CardTitle>
          <CardDescription>
            Preview how your widget will appear on your website.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedAgent && allowedDomain ? (
            <div className="relative bg-gray-100 p-8 rounded-md min-h-60">
              <div className="text-center text-gray-500 mb-8">
                Your Website Content
              </div>
              
              {/* Widget Preview */}
              <div 
                className={`absolute w-16 h-16 rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-all hover:scale-110 ${
                  widgetPosition === 'bottom-right' ? 'bottom-4 right-4' :
                  widgetPosition === 'bottom-left' ? 'bottom-4 left-4' :
                  widgetPosition === 'top-right' ? 'top-4 right-4' :
                  'top-4 left-4'
                }`}
                style={{ backgroundColor: widgetColor }}
              >
                {widgetType === 'chat' ? (
                  <MessageCircle className="h-6 w-6 text-white" />
                ) : (
                  <Phone className="h-6 w-6 text-white" />
                )}
              </div>

              {/* Chat bubble preview */}
              <div 
                className={`absolute bg-white p-3 rounded-lg shadow-lg max-w-64 ${
                  widgetPosition.includes('right') ? 'right-20' : 'left-20'
                } ${
                  widgetPosition.includes('bottom') ? 'bottom-4' : 'top-20'
                }`}
              >
                <div className="font-medium text-sm">{widgetTitle}</div>
                <div className="text-xs text-gray-600 mt-1">{widgetDescription}</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Configure widget settings to see preview
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">How to integrate your widget:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Select a published AI agent from the dropdown</li>
              <li>Enter your website domain (must match exactly)</li>
              <li>Customize the widget appearance and behavior</li>
              <li>Copy the generated embed code</li>
              <li>Paste the code before the closing &lt;/body&gt; tag on your website</li>
              <li>Ensure your domain is added to the allowed domains list in Security settings</li>
            </ol>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Widget features:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Responsive design that works on desktop and mobile</li>
              <li>Customizable colors and positioning</li>
              <li>Domain-restricted for security</li>
              <li>reCAPTCHA protection (when enabled)</li>
              <li>Real-time conversation with AI agents</li>
              <li>Automatic conversation history</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}