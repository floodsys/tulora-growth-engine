import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Copy, Globe, Eye, Code2, Shield, MessageSquare } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ChatWidget() {
  const { toast } = useToast()
  const [embedConfig, setEmbedConfig] = useState({
    widgetName: "Customer Support Chat",
    publicKey: "wk_live_1234567890abcdef",
    allowedDomains: ["yourdomain.com", "app.yourdomain.com"],
    captchaEnabled: true,
    customBranding: true,
    position: "bottom-right",
    theme: "auto"
  })

  const generateEmbedScript = () => {
    return `<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://widget.retell.ai/v1/widget.js';
    script.async = true;
    script.onload = function() {
      RetellWidget.init({
        publicKey: '${embedConfig.publicKey}',
        position: '${embedConfig.position}',
        theme: '${embedConfig.theme}',
        captcha: ${embedConfig.captchaEnabled},
        branding: ${embedConfig.customBranding}
      });
    };
    document.head.appendChild(script);
  })();
</script>`
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: "Embed code copied to clipboard",
    })
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Chat Widget</h1>
        <p className="text-muted-foreground">Configure and embed chat widgets on your website</p>
      </div>

      <div className="grid gap-6">
        {/* Widget Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Widget Configuration
            </CardTitle>
            <CardDescription>
              Configure your chat widget settings and appearance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="widgetName">Widget Name</Label>
                <Input
                  id="widgetName"
                  value={embedConfig.widgetName}
                  onChange={(e) => setEmbedConfig(prev => ({ ...prev, widgetName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <select 
                  className="w-full p-2 border rounded-md"
                  value={embedConfig.position}
                  onChange={(e) => setEmbedConfig(prev => ({ ...prev, position: e.target.value }))}
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <select 
                  className="w-full p-2 border rounded-md"
                  value={embedConfig.theme}
                  onChange={(e) => setEmbedConfig(prev => ({ ...prev, theme: e.target.value }))}
                >
                  <option value="auto">Auto (System)</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="customBranding"
                  checked={embedConfig.customBranding}
                  onCheckedChange={(checked) => setEmbedConfig(prev => ({ ...prev, customBranding: checked }))}
                />
                <Label htmlFor="customBranding">Show custom branding</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security & Access */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security & Access
            </CardTitle>
            <CardDescription>
              Configure security settings and domain restrictions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="publicKey">Public Key</Label>
              <div className="flex space-x-2">
                <Input
                  id="publicKey"
                  value={embedConfig.publicKey}
                  readOnly
                  className="font-mono"
                />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(embedConfig.publicKey)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                This key is safe to use in public frontend code
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="allowedDomains">Allowed Domains</Label>
              <div className="space-y-2">
                {embedConfig.allowedDomains.map((domain, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="secondary">{domain}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => {
                      const newDomains = embedConfig.allowedDomains.filter((_, i) => i !== index)
                      setEmbedConfig(prev => ({ ...prev, allowedDomains: newDomains }))
                    }}>
                      Remove
                    </Button>
                  </div>
                ))}
                <div className="flex space-x-2">
                  <Input placeholder="example.com" className="flex-1" id="newDomain" />
                  <Button onClick={() => {
                    const input = document.getElementById('newDomain') as HTMLInputElement
                    if (input.value) {
                      setEmbedConfig(prev => ({ 
                        ...prev, 
                        allowedDomains: [...prev.allowedDomains, input.value] 
                      }))
                      input.value = ""
                    }
                  }}>
                    Add Domain
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="captchaEnabled"
                checked={embedConfig.captchaEnabled}
                onCheckedChange={(checked) => setEmbedConfig(prev => ({ ...prev, captchaEnabled: checked }))}
              />
              <Label htmlFor="captchaEnabled">Enable CAPTCHA protection</Label>
            </div>
            {embedConfig.captchaEnabled && (
              <div className="ml-6 p-3 bg-muted/50 rounded-md">
                <p className="text-sm text-muted-foreground">
                  CAPTCHA will be shown before users can start a chat session to prevent spam and abuse.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Embed Code */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5" />
              Embed Code
            </CardTitle>
            <CardDescription>
              Copy this code and paste it into your website's HTML
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>JavaScript Embed Code</Label>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(generateEmbedScript())}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Code
                </Button>
              </div>
              <Textarea
                value={generateEmbedScript()}
                readOnly
                className="font-mono text-sm min-h-[160px]"
              />
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h4 className="font-medium text-blue-900 mb-2">Installation Instructions:</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Copy the embed code above</li>
                <li>Paste it before the closing &lt;/body&gt; tag on your website</li>
                <li>The chat widget will automatically appear on your site</li>
                <li>Test the widget to ensure it's working correctly</li>
              </ol>
            </div>
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
              Preview how your chat widget will appear on your website
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative border border-dashed border-gray-300 rounded-lg p-8 min-h-[200px] bg-gray-50">
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2" />
                  <p>Widget Preview</p>
                  <p className="text-sm">Position: {embedConfig.position}</p>
                </div>
              </div>
              
              {/* Mock widget button */}
              <div 
                className={`absolute w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg cursor-pointer
                  ${embedConfig.position.includes('bottom') ? 'bottom-4' : 'top-4'}
                  ${embedConfig.position.includes('right') ? 'right-4' : 'left-4'}
                `}
              >
                <MessageSquare className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}