import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { 
  Phone, 
  PhoneCall,
  Users,
  Settings,
  Plus,
  X,
  Webhook,
  Zap,
  Variable,
  Save,
  Info
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface TransferSettings {
  enableTransfer: boolean
  transferMode: 'warm' | 'cold' | 'disabled'
  transferNumber: string
  transferMessage: string
  maxTransferAttempts: number
}

interface WebhookTool {
  id: string
  name: string
  url: string
  method: 'GET' | 'POST' | 'PUT'
  headers: Record<string, string>
  description: string
  signature: string
  enabled: boolean
}

interface DynamicVariable {
  id: string
  name: string
  type: 'greeting' | 'voicemail' | 'transfer_target' | 'custom'
  value: string
  description: string
}

interface AgentTransferToolsProps {
  agentId: string
  currentSettings?: {
    transferSettings?: TransferSettings
    webhookTools?: WebhookTool[]
    dynamicVariables?: DynamicVariable[]
  }
  onSettingsUpdated?: (settings: any) => void
}

export function AgentTransferTools({ 
  agentId, 
  currentSettings = {}, 
  onSettingsUpdated 
}: AgentTransferToolsProps) {
  const [transferSettings, setTransferSettings] = useState<TransferSettings>({
    enableTransfer: false,
    transferMode: 'warm',
    transferNumber: '',
    transferMessage: 'Let me transfer you to a human agent who can better assist you.',
    maxTransferAttempts: 3,
    ...currentSettings.transferSettings
  })

  const [webhookTools, setWebhookTools] = useState<WebhookTool[]>(
    currentSettings.webhookTools || []
  )

  const [dynamicVariables, setDynamicVariables] = useState<DynamicVariable[]>(
    currentSettings.dynamicVariables || [
      {
        id: '1',
        name: 'greeting_message',
        type: 'greeting',
        value: 'Hello! How can I help you today?',
        description: 'The initial greeting message'
      },
      {
        id: '2',
        name: 'voicemail_message',
        type: 'voicemail',
        value: 'Please leave a message and we\'ll get back to you.',
        description: 'Message played when going to voicemail'
      }
    ]
  )

  const [addWebhookOpen, setAddWebhookOpen] = useState(false)
  const [addVariableOpen, setAddVariableOpen] = useState(false)
  const [newWebhook, setNewWebhook] = useState<Partial<WebhookTool>>({
    name: '',
    url: '',
    method: 'POST',
    headers: {},
    description: '',
    enabled: true
  })
  const [newVariable, setNewVariable] = useState<Partial<DynamicVariable>>({
    name: '',
    type: 'custom',
    value: '',
    description: ''
  })
  const [headerKey, setHeaderKey] = useState('')
  const [headerValue, setHeaderValue] = useState('')

  const { toast } = useToast()

  const handleSaveSettings = () => {
    const settings = {
      transferSettings,
      webhookTools,
      dynamicVariables
    }
    
    onSettingsUpdated?.(settings)
    
    toast({
      title: "Settings Saved",
      description: "Transfer and tools configuration has been updated."
    })
  }

  const handleAddWebhook = () => {
    if (!newWebhook.name || !newWebhook.url) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in name and URL for the webhook.",
        variant: "destructive"
      })
      return
    }

    const webhook: WebhookTool = {
      id: Date.now().toString(),
      name: newWebhook.name,
      url: newWebhook.url,
      method: newWebhook.method || 'POST',
      headers: newWebhook.headers || {},
      description: newWebhook.description || '',
      signature: `${newWebhook.method} ${newWebhook.url}`,
      enabled: newWebhook.enabled ?? true
    }

    setWebhookTools(prev => [...prev, webhook])
    setNewWebhook({
      name: '',
      url: '',
      method: 'POST',
      headers: {},
      description: '',
      enabled: true
    })
    setAddWebhookOpen(false)
  }

  const handleAddVariable = () => {
    if (!newVariable.name || !newVariable.value) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in name and value for the variable.",
        variant: "destructive"
      })
      return
    }

    const variable: DynamicVariable = {
      id: Date.now().toString(),
      name: newVariable.name,
      type: newVariable.type || 'custom',
      value: newVariable.value,
      description: newVariable.description || ''
    }

    setDynamicVariables(prev => [...prev, variable])
    setNewVariable({
      name: '',
      type: 'custom',
      value: '',
      description: ''
    })
    setAddVariableOpen(false)
  }

  const addHeader = () => {
    if (headerKey && headerValue) {
      setNewWebhook(prev => ({
        ...prev,
        headers: {
          ...prev.headers,
          [headerKey]: headerValue
        }
      }))
      setHeaderKey('')
      setHeaderValue('')
    }
  }

  const removeHeader = (key: string) => {
    setNewWebhook(prev => {
      const headers = { ...prev.headers }
      delete headers[key]
      return { ...prev, headers }
    })
  }

  const removeWebhook = (id: string) => {
    setWebhookTools(prev => prev.filter(w => w.id !== id))
  }

  const removeVariable = (id: string) => {
    setDynamicVariables(prev => prev.filter(v => v.id !== id))
  }

  const toggleWebhook = (id: string, enabled: boolean) => {
    setWebhookTools(prev => prev.map(w => 
      w.id === id ? { ...w, enabled } : w
    ))
  }

  return (
    <div className="space-y-6">
      {/* Transfer Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5" />
            Transfer Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enableTransfer">Enable Human Transfer</Label>
              <p className="text-sm text-muted-foreground">
                Allow the agent to transfer calls to human operators
              </p>
            </div>
            <Switch
              id="enableTransfer"
              checked={transferSettings.enableTransfer}
              onCheckedChange={(checked) => 
                setTransferSettings(prev => ({ ...prev, enableTransfer: checked }))
              }
            />
          </div>

          {transferSettings.enableTransfer && (
            <>
              <Separator />
              
              <div>
                <Label>Transfer Mode</Label>
                <Select 
                  value={transferSettings.transferMode} 
                  onValueChange={(value: 'warm' | 'cold') => 
                    setTransferSettings(prev => ({ ...prev, transferMode: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Warm Transfer (Agent stays on line)
                      </div>
                    </SelectItem>
                    <SelectItem value="cold">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Cold Transfer (Direct handoff)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="transferNumber">Transfer Number</Label>
                <Input
                  id="transferNumber"
                  value={transferSettings.transferNumber}
                  onChange={(e) => 
                    setTransferSettings(prev => ({ ...prev, transferNumber: e.target.value }))
                  }
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <Label htmlFor="transferMessage">Transfer Message</Label>
                <Textarea
                  id="transferMessage"
                  value={transferSettings.transferMessage}
                  onChange={(e) => 
                    setTransferSettings(prev => ({ ...prev, transferMessage: e.target.value }))
                  }
                  placeholder="What the agent says before transferring..."
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="maxAttempts">Max Transfer Attempts</Label>
                <Input
                  id="maxAttempts"
                  type="number"
                  min="1"
                  max="5"
                  value={transferSettings.maxTransferAttempts}
                  onChange={(e) => 
                    setTransferSettings(prev => ({ 
                      ...prev, 
                      maxTransferAttempts: parseInt(e.target.value) || 1 
                    }))
                  }
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Webhook Tools */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Custom Functions ({webhookTools.length})
            </CardTitle>
            <Dialog open={addWebhookOpen} onOpenChange={setAddWebhookOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Function
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Custom Function</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="webhookName">Function Name</Label>
                      <Input
                        id="webhookName"
                        value={newWebhook.name}
                        onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Create Ticket"
                      />
                    </div>
                    <div>
                      <Label>HTTP Method</Label>
                      <Select 
                        value={newWebhook.method} 
                        onValueChange={(value: 'GET' | 'POST' | 'PUT') => 
                          setNewWebhook(prev => ({ ...prev, method: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="webhookUrl">Endpoint URL</Label>
                    <Input
                      id="webhookUrl"
                      value={newWebhook.url}
                      onChange={(e) => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://your-api.com/webhook"
                    />
                  </div>

                  <div>
                    <Label htmlFor="webhookDescription">Description</Label>
                    <Textarea
                      id="webhookDescription"
                      value={newWebhook.description}
                      onChange={(e) => setNewWebhook(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="What this function does..."
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Headers</Label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Header name"
                          value={headerKey}
                          onChange={(e) => setHeaderKey(e.target.value)}
                        />
                        <Input
                          placeholder="Header value"
                          value={headerValue}
                          onChange={(e) => setHeaderValue(e.target.value)}
                        />
                        <Button onClick={addHeader} disabled={!headerKey || !headerValue}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {Object.entries(newWebhook.headers || {}).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline">{key}: {value}</Badge>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeHeader(key)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      This function will be available to your agent during conversations.
                      HMAC signature verification will be included for security.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setAddWebhookOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddWebhook}>
                      Add Function
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {webhookTools.length === 0 ? (
            <div className="text-center py-8">
              <Webhook className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Custom Functions</h3>
              <p className="text-muted-foreground mb-4">
                Add webhook endpoints that your agent can call during conversations.
              </p>
              <Button onClick={() => setAddWebhookOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Function
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {webhookTools.map(webhook => (
                <div key={webhook.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <Zap className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-medium">{webhook.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {webhook.method} {webhook.url}
                      </div>
                      {webhook.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {webhook.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={webhook.enabled}
                      onCheckedChange={(checked) => toggleWebhook(webhook.id, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeWebhook(webhook.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dynamic Variables */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Variable className="h-5 w-5" />
              Dynamic Variables ({dynamicVariables.length})
            </CardTitle>
            <Dialog open={addVariableOpen} onOpenChange={setAddVariableOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variable
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Dynamic Variable</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="varName">Variable Name</Label>
                    <Input
                      id="varName"
                      value={newVariable.name}
                      onChange={(e) => setNewVariable(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., company_name"
                    />
                  </div>

                  <div>
                    <Label>Type</Label>
                    <Select 
                      value={newVariable.type} 
                      onValueChange={(value: 'greeting' | 'voicemail' | 'transfer_target' | 'custom') => 
                        setNewVariable(prev => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="greeting">Greeting Message</SelectItem>
                        <SelectItem value="voicemail">Voicemail Message</SelectItem>
                        <SelectItem value="transfer_target">Transfer Target</SelectItem>
                        <SelectItem value="custom">Custom Variable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="varValue">Value</Label>
                    <Textarea
                      id="varValue"
                      value={newVariable.value}
                      onChange={(e) => setNewVariable(prev => ({ ...prev, value: e.target.value }))}
                      placeholder="Variable value..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="varDescription">Description</Label>
                    <Input
                      id="varDescription"
                      value={newVariable.description}
                      onChange={(e) => setNewVariable(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="What this variable is used for..."
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setAddVariableOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddVariable}>
                      Add Variable
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dynamicVariables.map(variable => (
              <div key={variable.id} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-3">
                  <Variable className="h-4 w-4 text-primary" />
                  <div>
                    <div className="font-medium">{variable.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {variable.value}
                    </div>
                    {variable.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {variable.description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{variable.type}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVariable(variable.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} className="gap-2">
          <Save className="h-4 w-4" />
          Save All Settings
        </Button>
      </div>
    </div>
  )
}