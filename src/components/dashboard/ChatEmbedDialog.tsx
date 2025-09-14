import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Copy, Palette, Eye, Code, Phone } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface BrandingConfig {
  title: string
  botName: string
  welcomeMessage: string
  primaryColor: string
  logoUrl: string
}

interface ChatEmbedDialogProps {
  agent: {
    id: string
    agent_id: string
    name: string
    organization_id: string
  }
}

export const ChatEmbedDialog = ({ agent }: ChatEmbedDialogProps) => {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [branding, setBranding] = useState<BrandingConfig>({
    title: "Chat with us",
    botName: agent.name,
    welcomeMessage: `Hi! I'm ${agent.name}. How can I help you today?`,
    primaryColor: "#2563eb",
    logoUrl: ""
  })

  const generateChatSnippet = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('retell-widgets-chat-snippet', {
        body: {
          agentId: agent.agent_id,
          organizationId: agent.organization_id,
          branding
        }
      })

      if (error) throw error
      return data.snippet
    } catch (error) {
      console.error('Error generating chat snippet:', error)
      toast({
        title: "Error",
        description: "Failed to generate chat embed code. Please try again.",
        variant: "destructive"
      })
      return ""
    } finally {
      setLoading(false)
    }
  }

  const generateCallbackSnippet = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('retell-widgets-callback-snippet', {
        body: {
          agentId: agent.agent_id,
          organizationId: agent.organization_id,
          branding
        }
      })

      if (error) throw error
      return data.snippet
    } catch (error) {
      console.error('Error generating callback snippet:', error)
      toast({
        title: "Error",
        description: "Failed to generate callback widget code. Please try again.",
        variant: "destructive"
      })
      return ""
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied!",
        description: "Embed code copied to clipboard.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard.",
        variant: "destructive"
      })
    }
  }

  const [chatSnippet, setChatSnippet] = useState("")
  const [callbackSnippet, setCallbackSnippet] = useState("")

  const handleGenerateSnippets = async () => {
    const [chat, callback] = await Promise.all([
      generateChatSnippet(),
      generateCallbackSnippet()
    ])
    setChatSnippet(chat)
    setCallbackSnippet(callback)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquare className="h-4 w-4 mr-2" />
          Get Chat Embed
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Chat Widget Configuration
          </DialogTitle>
          <DialogDescription>
            Customize and generate embed code for your chat widget
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="branding" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="branding">
              <Palette className="h-4 w-4 mr-2" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="chat-embed">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat Embed
            </TabsTrigger>
            <TabsTrigger value="callback-widget">
              <Phone className="h-4 w-4 mr-2" />
              Callback Widget
            </TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Widget Branding</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title">Widget Title</Label>
                    <Input
                      id="title"
                      value={branding.title}
                      onChange={(e) => setBranding(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Chat with us"
                    />
                  </div>
                  <div>
                    <Label htmlFor="botName">Bot Name</Label>
                    <Input
                      id="botName"
                      value={branding.botName}
                      onChange={(e) => setBranding(prev => ({ ...prev, botName: e.target.value }))}
                      placeholder={agent.name}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="welcomeMessage">Welcome Message</Label>
                  <Textarea
                    id="welcomeMessage"
                    value={branding.welcomeMessage}
                    onChange={(e) => setBranding(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                    placeholder="Hi! How can I help you today?"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="primaryColor">Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="primaryColor"
                        type="color"
                        value={branding.primaryColor}
                        onChange={(e) => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-20 h-10"
                      />
                      <Input
                        value={branding.primaryColor}
                        onChange={(e) => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))}
                        placeholder="#2563eb"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="logoUrl">Logo URL (Optional)</Label>
                    <Input
                      id="logoUrl"
                      value={branding.logoUrl}
                      onChange={(e) => setBranding(prev => ({ ...prev, logoUrl: e.target.value }))}
                      placeholder="https://your-site.com/logo.png"
                    />
                  </div>
                </div>

                <div className="flex justify-center pt-4">
                  <Button onClick={handleGenerateSnippets} disabled={loading}>
                    {loading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white mr-2" />
                    ) : (
                      <Code className="h-4 w-4 mr-2" />
                    )}
                    Generate Embed Code
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat-embed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Chat Widget Embed Code</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Add this code to your website to embed the chat widget
                </p>
              </CardHeader>
              <CardContent>
                {chatSnippet ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <Textarea
                        value={chatSnippet}
                        readOnly
                        rows={12}
                        className="font-mono text-sm bg-muted"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(chatSnippet)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary">HTML</Badge>
                      <span>Copy and paste this code before the closing &lt;/body&gt; tag</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Code className="h-12 w-12 mx-auto mb-4" />
                    <p>Generate embed code from the Branding tab first</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="callback-widget" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Voice Callback Widget</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Add this code to enable voice callback requests on your website
                </p>
              </CardHeader>
              <CardContent>
                {callbackSnippet ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <Textarea
                        value={callbackSnippet}
                        readOnly
                        rows={12}
                        className="font-mono text-sm bg-muted"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(callbackSnippet)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary">HTML</Badge>
                      <span>Visitors can request a callback through this widget</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Phone className="h-12 w-12 mx-auto mb-4" />
                    <p>Generate embed code from the Branding tab first</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}