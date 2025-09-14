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
  BarChart3, 
  Plus,
  X,
  Brain,
  Target,
  Code,
  Text,
  ToggleLeft,
  Hash,
  FileJson,
  Save,
  Webhook,
  Database,
  Settings,
  Zap
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AnalysisField {
  id: string
  name: string
  type: 'boolean' | 'enum' | 'text' | 'json' | 'number'
  description: string
  prompt: string
  required: boolean
  enumValues?: string[]
  defaultValue?: any
  enabled: boolean
}

interface AnalysisSettings {
  enabled: boolean
  model: string
  analysisPrompt: string
  fields: AnalysisField[]
  
  // Output routing
  sendToWebhook: boolean
  sendToDashboard: boolean
  sendToAPI: boolean
  webhookUrl?: string
  
  // Advanced settings
  runAsync: boolean
  includeTranscript: boolean
  includeMetadata: boolean
  customInstructions: string
}

interface AgentAnalysisSettingsProps {
  agentId: string
  currentSettings?: Partial<AnalysisSettings>
  onSettingsUpdated?: (settings: AnalysisSettings) => void
}

export function AgentAnalysisSettings({ 
  agentId, 
  currentSettings = {}, 
  onSettingsUpdated 
}: AgentAnalysisSettingsProps) {
  const [settings, setSettings] = useState<AnalysisSettings>({
    enabled: false,
    model: 'gpt-5-2025-08-07',
    analysisPrompt: 'Analyze this call and extract the requested information.',
    fields: [],
    sendToWebhook: true,
    sendToDashboard: true,
    sendToAPI: false,
    runAsync: true,
    includeTranscript: true,
    includeMetadata: true,
    customInstructions: '',
    ...currentSettings
  })

  const [addFieldOpen, setAddFieldOpen] = useState(false)
  const [newField, setNewField] = useState<Partial<AnalysisField>>({
    name: '',
    type: 'text',
    description: '',
    prompt: '',
    required: false,
    enabled: true
  })
  const [enumValue, setEnumValue] = useState('')

  const { toast } = useToast()

  const availableModels = [
    { id: 'gpt-5-2025-08-07', name: 'GPT-5 (Latest)', description: 'Most capable model for complex analysis' },
    { id: 'gpt-5-mini-2025-08-07', name: 'GPT-5 Mini', description: 'Fast and cost-efficient' },
    { id: 'gpt-4.1-2025-04-14', name: 'GPT-4.1', description: 'Reliable analysis model' },
    { id: 'o3-2025-04-16', name: 'o3 Reasoning', description: 'Advanced reasoning for complex analysis' },
    { id: 'o4-mini-2025-04-16', name: 'o4 Mini', description: 'Fast reasoning model' }
  ]

  const defaultFields: AnalysisField[] = [
    {
      id: 'sentiment',
      name: 'Sentiment',
      type: 'enum',
      description: 'Overall sentiment of the conversation',
      prompt: 'What is the overall sentiment of this conversation?',
      required: true,
      enumValues: ['positive', 'neutral', 'negative'],
      enabled: true
    },
    {
      id: 'lead_quality',
      name: 'Lead Quality',
      type: 'enum',
      description: 'Quality assessment of the lead',
      prompt: 'Based on BANT methodology, what is the quality of this lead?',
      required: false,
      enumValues: ['hot', 'warm', 'cold', 'unqualified'],
      enabled: true
    },
    {
      id: 'intent_detected',
      name: 'Intent Detected',
      type: 'boolean',
      description: 'Whether clear purchase intent was detected',
      prompt: 'Did the caller express clear purchase intent?',
      required: false,
      enabled: true
    },
    {
      id: 'summary',
      name: 'Call Summary',
      type: 'text',
      description: 'Brief summary of the conversation',
      prompt: 'Provide a concise summary of this conversation in 2-3 sentences.',
      required: true,
      enabled: true
    },
    {
      id: 'next_steps',
      name: 'Next Steps',
      type: 'json',
      description: 'Recommended follow-up actions',
      prompt: 'What are the recommended next steps based on this conversation? Return as JSON with action and priority.',
      required: false,
      enabled: true
    }
  ]

  const handleSaveSettings = () => {
    onSettingsUpdated?.(settings)
    
    toast({
      title: "Analysis Settings Saved",
      description: "Post-call analysis configuration has been updated."
    })
  }

  const handleAddField = () => {
    if (!newField.name || !newField.description) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in name and description for the field.",
        variant: "destructive"
      })
      return
    }

    const field: AnalysisField = {
      id: Date.now().toString(),
      name: newField.name!,
      type: newField.type || 'text',
      description: newField.description!,
      prompt: newField.prompt || `Extract ${newField.name} from this conversation.`,
      required: newField.required || false,
      enumValues: newField.enumValues || [],
      enabled: newField.enabled ?? true
    }

    setSettings(prev => ({
      ...prev,
      fields: [...prev.fields, field]
    }))

    setNewField({
      name: '',
      type: 'text',
      description: '',
      prompt: '',
      required: false,
      enabled: true
    })
    setAddFieldOpen(false)
  }

  const addDefaultFields = () => {
    setSettings(prev => ({
      ...prev,
      fields: [...prev.fields, ...defaultFields.filter(df => 
        !prev.fields.some(f => f.id === df.id)
      )]
    }))
  }

  const removeField = (id: string) => {
    setSettings(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== id)
    }))
  }

  const toggleField = (id: string, enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      fields: prev.fields.map(f => 
        f.id === id ? { ...f, enabled } : f
      )
    }))
  }

  const addEnumValue = () => {
    if (enumValue && newField.enumValues) {
      setNewField(prev => ({
        ...prev,
        enumValues: [...(prev.enumValues || []), enumValue]
      }))
      setEnumValue('')
    }
  }

  const removeEnumValue = (value: string) => {
    setNewField(prev => ({
      ...prev,
      enumValues: prev.enumValues?.filter(v => v !== value) || []
    }))
  }

  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'boolean': return <ToggleLeft className="h-4 w-4" />
      case 'enum': return <Target className="h-4 w-4" />
      case 'text': return <Text className="h-4 w-4" />
      case 'json': return <FileJson className="h-4 w-4" />
      case 'number': return <Hash className="h-4 w-4" />
      default: return <Code className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Main Analysis Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Post-Call Analysis
            </CardTitle>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, enabled: checked }))
              }
            />
          </div>
        </CardHeader>
        
        {settings.enabled && (
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="model">Analysis Model</Label>
              <Select 
                value={settings.model} 
                onValueChange={(value) => setSettings(prev => ({ ...prev, model: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      <div>
                        <div className="font-medium">{model.name}</div>
                        <div className="text-xs text-muted-foreground">{model.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="prompt">Base Analysis Prompt</Label>
              <Textarea
                id="prompt"
                value={settings.analysisPrompt}
                onChange={(e) => setSettings(prev => ({ ...prev, analysisPrompt: e.target.value }))}
                placeholder="Instructions for the AI on how to analyze calls..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="includeTranscript"
                  checked={settings.includeTranscript}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, includeTranscript: checked }))
                  }
                />
                <Label htmlFor="includeTranscript" className="text-sm">Include Transcript</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="includeMetadata"
                  checked={settings.includeMetadata}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, includeMetadata: checked }))
                  }
                />
                <Label htmlFor="includeMetadata" className="text-sm">Include Metadata</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="runAsync"
                  checked={settings.runAsync}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, runAsync: checked }))
                  }
                />
                <Label htmlFor="runAsync" className="text-sm">Run Async</Label>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Analysis Fields */}
      {settings.enabled && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Analysis Fields ({settings.fields.length})
              </CardTitle>
              <div className="flex gap-2">
                {settings.fields.length === 0 && (
                  <Button variant="outline" size="sm" onClick={addDefaultFields}>
                    <Zap className="h-4 w-4 mr-2" />
                    Add Defaults
                  </Button>
                )}
                <Dialog open={addFieldOpen} onOpenChange={setAddFieldOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Field
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Add Analysis Field</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="fieldName">Field Name</Label>
                          <Input
                            id="fieldName"
                            value={newField.name}
                            onChange={(e) => setNewField(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., lead_score"
                          />
                        </div>
                        <div>
                          <Label>Field Type</Label>
                          <Select 
                            value={newField.type} 
                            onValueChange={(value: 'boolean' | 'enum' | 'text' | 'json' | 'number') => {
                              setNewField(prev => ({ ...prev, type: value }))
                              if (value === 'enum' && !newField.enumValues) {
                                setNewField(prev => ({ ...prev, enumValues: [] }))
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="boolean">Boolean (true/false)</SelectItem>
                              <SelectItem value="enum">Enum (predefined options)</SelectItem>
                              <SelectItem value="text">Text (free form)</SelectItem>
                              <SelectItem value="json">JSON (structured data)</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="fieldDescription">Description</Label>
                        <Input
                          id="fieldDescription"
                          value={newField.description}
                          onChange={(e) => setNewField(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="What this field represents..."
                        />
                      </div>

                      <div>
                        <Label htmlFor="fieldPrompt">Analysis Prompt</Label>
                        <Textarea
                          id="fieldPrompt"
                          value={newField.prompt}
                          onChange={(e) => setNewField(prev => ({ ...prev, prompt: e.target.value }))}
                          placeholder="Instructions for extracting this field..."
                          rows={2}
                        />
                      </div>

                      {newField.type === 'enum' && (
                        <div>
                          <Label>Enum Values</Label>
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <Input
                                placeholder="Add enum value"
                                value={enumValue}
                                onChange={(e) => setEnumValue(e.target.value)}
                              />
                              <Button onClick={addEnumValue} disabled={!enumValue}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {newField.enumValues?.map((value, idx) => (
                                <Badge key={idx} variant="outline" className="gap-1">
                                  {value}
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => removeEnumValue(value)}
                                    className="h-auto p-0 ml-1"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="fieldRequired"
                          checked={newField.required}
                          onCheckedChange={(checked) => setNewField(prev => ({ ...prev, required: checked }))}
                        />
                        <Label htmlFor="fieldRequired">Required Field</Label>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setAddFieldOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddField}>
                          Add Field
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {settings.fields.length === 0 ? (
              <div className="text-center py-8">
                <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Analysis Fields</h3>
                <p className="text-muted-foreground mb-4">
                  Add fields to extract specific information from your calls.
                </p>
                <Button onClick={() => setAddFieldOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Field
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {settings.fields.map(field => (
                  <div key={field.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      {getFieldIcon(field.type)}
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {field.name}
                          {field.required && <Badge variant="outline" className="text-xs">Required</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {field.description}
                        </div>
                        {field.type === 'enum' && field.enumValues && (
                          <div className="flex gap-1 mt-1">
                            {field.enumValues.map(value => (
                              <Badge key={value} variant="secondary" className="text-xs">
                                {value}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={field.enabled}
                        onCheckedChange={(checked) => toggleField(field.id, checked)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeField(field.id)}
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
      )}

      {/* Output Routing */}
      {settings.enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Output Routing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="sendToDashboard"
                  checked={settings.sendToDashboard}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, sendToDashboard: checked }))
                  }
                />
                <div>
                  <Label htmlFor="sendToDashboard" className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Dashboard
                  </Label>
                  <p className="text-xs text-muted-foreground">Store in dashboard</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="sendToWebhook"
                  checked={settings.sendToWebhook}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, sendToWebhook: checked }))
                  }
                />
                <div>
                  <Label htmlFor="sendToWebhook" className="flex items-center gap-2">
                    <Webhook className="h-4 w-4" />
                    Webhook
                  </Label>
                  <p className="text-xs text-muted-foreground">Send via webhook</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="sendToAPI"
                  checked={settings.sendToAPI}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, sendToAPI: checked }))
                  }
                />
                <div>
                  <Label htmlFor="sendToAPI" className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    API Access
                  </Label>
                  <p className="text-xs text-muted-foreground">Available via API</p>
                </div>
              </div>
            </div>

            {settings.sendToWebhook && (
              <div>
                <Label htmlFor="webhookUrl">Analysis Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  value={settings.webhookUrl}
                  onChange={(e) => setSettings(prev => ({ ...prev, webhookUrl: e.target.value }))}
                  placeholder="https://your-api.com/analysis-webhook"
                />
              </div>
            )}

            <div>
              <Label htmlFor="customInstructions">Custom Instructions</Label>
              <Textarea
                id="customInstructions"
                value={settings.customInstructions}
                onChange={(e) => setSettings(prev => ({ ...prev, customInstructions: e.target.value }))}
                placeholder="Additional instructions for the analysis..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} className="gap-2">
          <Save className="h-4 w-4" />
          Save Analysis Settings
        </Button>
      </div>
    </div>
  )
}