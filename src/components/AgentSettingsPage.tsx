import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Bot, 
  Settings, 
  Database, 
  PhoneCall, 
  Webhook,
  Save,
  ArrowLeft,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle
} from "lucide-react"
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { useRetellAgents } from "@/hooks/useRetellAgents"
import { AgentKnowledgeManager } from "@/components/AgentKnowledgeManager"
import { AgentTransferTools } from "@/components/AgentTransferTools"
import { useToast } from "@/hooks/use-toast"

export function AgentSettingsPage() {
  const { agentId } = useParams()
  const navigate = useNavigate()
  const { organization } = useUserOrganization()
  const { agents, getAgent, updateAgentSettings, publishAgent, loading } = useRetellAgents(organization?.id)
  const { toast } = useToast()

  const [agent, setAgent] = useState<any>(null)
  const [agentSettings, setAgentSettings] = useState({
    name: '',
    voice_id: '',
    voice_model: '',
    language: 'en',
    max_call_duration_ms: 1800000,
    end_call_after_silence_ms: 10000,
    begin_message_delay_ms: 800,
    voice_speed: 1.0,
    voice_temperature: 1.0,
    volume: 1.0,
    backchannel_enabled: false,
    backchannel_frequency: 0.8,
    normalize_for_speech: true,
    opt_in_signed_url: false,
    voicemail_option: 'disabled',
    data_storage_setting: 'standard',
    status: 'draft'
  })
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    if (agentId && agents.length > 0) {
      const foundAgent = getAgent(agentId)
      if (foundAgent) {
        setAgent(foundAgent)
        setAgentSettings({
          name: foundAgent.name || '',
          voice_id: foundAgent.voice_id || '',
          voice_model: foundAgent.voice_model || '',
          language: foundAgent.language || 'en',
          max_call_duration_ms: foundAgent.max_call_duration_ms || 1800000,
          end_call_after_silence_ms: foundAgent.end_call_after_silence_ms || 10000,
          begin_message_delay_ms: foundAgent.begin_message_delay_ms || 800,
          voice_speed: foundAgent.voice_speed || 1.0,
          voice_temperature: foundAgent.voice_temperature || 1.0,
          volume: foundAgent.volume || 1.0,
          backchannel_enabled: foundAgent.backchannel_enabled || false,
          backchannel_frequency: foundAgent.backchannel_frequency || 0.8,
          normalize_for_speech: foundAgent.normalize_for_speech ?? true,
          opt_in_signed_url: foundAgent.opt_in_signed_url || false,
          voicemail_option: foundAgent.voicemail_option || 'disabled',
          data_storage_setting: foundAgent.data_storage_setting || 'standard',
          status: foundAgent.status || 'draft'
        })
      }
    }
  }, [agentId, agents, getAgent])

  const handleSaveSettings = async () => {
    if (!agent) return

    setSaving(true)
    try {
      await updateAgentSettings(agent.id, agentSettings)
      setAgent(prev => ({ ...prev, ...agentSettings }))
    } finally {
      setSaving(false)
    }
  }

  const handlePublishAgent = async () => {
    if (!agent) return

    setPublishing(true)
    try {
      await publishAgent(agent.id)
      setAgent(prev => ({ ...prev, status: 'published' }))
      setAgentSettings(prev => ({ ...prev, status: 'published' }))
    } finally {
      setPublishing(false)
    }
  }

  const handleKBsUpdated = async (kbIds: string[]) => {
    if (!agent) return

    await updateAgentSettings(agent.id, { kb_ids: kbIds })
    setAgent(prev => ({ ...prev, kb_ids: kbIds }))
  }

  const handleTransferToolsUpdated = async (settings: any) => {
    if (!agent) return

    const updateData = {
      transfer_number: settings.transferSettings?.transferNumber,
      transfer_mode: settings.transferSettings?.transferMode,
      webhook_url: settings.webhookTools?.[0]?.url, // Simplified for now
      settings: {
        ...agent.settings,
        transferSettings: settings.transferSettings,
        webhookTools: settings.webhookTools,
        dynamicVariables: settings.dynamicVariables
      }
    }

    await updateAgentSettings(agent.id, updateData)
    setAgent(prev => ({ ...prev, ...updateData }))
  }

  if (loading || !agent) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
            <p className="text-muted-foreground">Loading agent settings...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/dashboard/agents')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Agents
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="h-6 w-6" />
              {agent.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge 
                className={
                  agent.status === 'published' 
                    ? "bg-success text-success-foreground"
                    : "bg-warning text-warning-foreground"
                }
              >
                {agent.status === 'published' ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Published
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Draft
                  </>
                )}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Agent ID: {agent.agent_id}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleSaveSettings}
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
          {agent.status === 'draft' && (
            <Button
              onClick={handlePublishAgent}
              disabled={publishing}
            >
              <Play className="h-4 w-4 mr-2" />
              {publishing ? 'Publishing...' : 'Publish'}
            </Button>
          )}
          {agent.status === 'published' && (
            <Button variant="outline">
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Knowledge
          </TabsTrigger>
          <TabsTrigger value="transfers" className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4" />
            Transfers & Tools
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Agent Name</Label>
                  <Input
                    id="name"
                    value={agentSettings.name}
                    onChange={(e) => setAgentSettings(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="language">Language</Label>
                  <Select 
                    value={agentSettings.language} 
                    onValueChange={(value) => setAgentSettings(prev => ({ ...prev, language: value }))}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="voiceId">Voice ID</Label>
                  <Input
                    id="voiceId"
                    value={agentSettings.voice_id}
                    onChange={(e) => setAgentSettings(prev => ({ ...prev, voice_id: e.target.value }))}
                    placeholder="e.g., alloy, echo, fable..."
                  />
                </div>
                <div>
                  <Label htmlFor="voiceModel">Voice Model</Label>
                  <Select 
                    value={agentSettings.voice_model} 
                    onValueChange={(value) => setAgentSettings(prev => ({ ...prev, voice_model: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select voice model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eleven_multilingual_v2">ElevenLabs Multilingual v2</SelectItem>
                      <SelectItem value="eleven_turbo_v2_5">ElevenLabs Turbo v2.5</SelectItem>
                      <SelectItem value="openai_tts">OpenAI TTS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Voice Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="voiceSpeed">Voice Speed</Label>
                  <Input
                    id="voiceSpeed"
                    type="number"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={agentSettings.voice_speed}
                    onChange={(e) => setAgentSettings(prev => ({ ...prev, voice_speed: parseFloat(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label htmlFor="voiceTemp">Voice Temperature</Label>
                  <Input
                    id="voiceTemp"
                    type="number"
                    min="0.0"
                    max="2.0"
                    step="0.1"
                    value={agentSettings.voice_temperature}
                    onChange={(e) => setAgentSettings(prev => ({ ...prev, voice_temperature: parseFloat(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label htmlFor="volume">Volume</Label>
                  <Input
                    id="volume"
                    type="number"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={agentSettings.volume}
                    onChange={(e) => setAgentSettings(prev => ({ ...prev, volume: parseFloat(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="backchannel">Enable Backchannel</Label>
                  <p className="text-sm text-muted-foreground">
                    Agent makes conversational sounds like "mm-hmm" during calls
                  </p>
                </div>
                <Switch
                  id="backchannel"
                  checked={agentSettings.backchannel_enabled}
                  onCheckedChange={(checked) => 
                    setAgentSettings(prev => ({ ...prev, backchannel_enabled: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Call Behavior</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="maxDuration">Max Call Duration (ms)</Label>
                  <Input
                    id="maxDuration"
                    type="number"
                    value={agentSettings.max_call_duration_ms}
                    onChange={(e) => setAgentSettings(prev => ({ ...prev, max_call_duration_ms: parseInt(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label htmlFor="silenceEnd">End After Silence (ms)</Label>
                  <Input
                    id="silenceEnd"
                    type="number"
                    value={agentSettings.end_call_after_silence_ms}
                    onChange={(e) => setAgentSettings(prev => ({ ...prev, end_call_after_silence_ms: parseInt(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label htmlFor="beginDelay">Begin Message Delay (ms)</Label>
                  <Input
                    id="beginDelay"
                    type="number"
                    value={agentSettings.begin_message_delay_ms}
                    onChange={(e) => setAgentSettings(prev => ({ ...prev, begin_message_delay_ms: parseInt(e.target.value) }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="voicemail">Voicemail Option</Label>
                <Select 
                  value={agentSettings.voicemail_option} 
                  onValueChange={(value) => setAgentSettings(prev => ({ ...prev, voicemail_option: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Disabled</SelectItem>
                    <SelectItem value="voicemail_message">Play voicemail message</SelectItem>
                    <SelectItem value="leave_voicemail">Allow leaving voicemail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge">
          <AgentKnowledgeManager
            agentId={agent.id}
            currentKBIds={agent.kb_ids || []}
            onKBsUpdated={handleKBsUpdated}
          />
        </TabsContent>

        <TabsContent value="transfers">
          <AgentTransferTools
            agentId={agent.id}
            currentSettings={{
              transferSettings: agent.settings?.transferSettings,
              webhookTools: agent.settings?.webhookTools || [],
              dynamicVariables: agent.settings?.dynamicVariables || []
            }}
            onSettingsUpdated={handleTransferToolsUpdated}
          />
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="normalize">Normalize for Speech</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically optimize text for speech synthesis
                  </p>
                </div>
                <Switch
                  id="normalize"
                  checked={agentSettings.normalize_for_speech}
                  onCheckedChange={(checked) => 
                    setAgentSettings(prev => ({ ...prev, normalize_for_speech: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="signedUrl">Opt-in Signed URLs</Label>
                  <p className="text-sm text-muted-foreground">
                    Require signed URLs for enhanced security
                  </p>
                </div>
                <Switch
                  id="signedUrl"
                  checked={agentSettings.opt_in_signed_url}
                  onCheckedChange={(checked) => 
                    setAgentSettings(prev => ({ ...prev, opt_in_signed_url: checked }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="dataStorage">Data Storage Setting</Label>
                <Select 
                  value={agentSettings.data_storage_setting} 
                  onValueChange={(value) => setAgentSettings(prev => ({ ...prev, data_storage_setting: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="enhanced">Enhanced</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Advanced settings can significantly impact agent performance. 
              Only modify these if you understand their implications.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  )
}