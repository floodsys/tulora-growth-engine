import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Bot, Mic, Play, Save, Settings, Volume2, Database, PhoneCall, Plus, X, ExternalLink, Zap } from 'lucide-react'
import { useRetellAgents } from '@/hooks/useRetellAgents'
import { useUserOrganization } from '@/hooks/useUserOrganization'
import { useToast } from '@/hooks/use-toast'
import { KnowledgeBaseView } from '@/components/KnowledgeBaseView'

export const AgentSettings = () => {
  const { agentId } = useParams()
  const navigate = useNavigate()
  const { organization } = useUserOrganization()
  const { agents, voices, updateAgent, loadVoices } = useRetellAgents(organization?.id)
  const { toast } = useToast()

  const [agent, setAgent] = useState<any>(null)
  const [settings, setSettings] = useState({
    // Basics
    name: '',
    type: 'prompt' as 'prompt' | 'flow',
    language: 'en',
    multilingual: false,
    prompt: '',
    llm_model: 'gpt-4',
    temperature: 0.7,
    
    // Voice
    voice_id: '',
    voice_model: '',
    voice_temperature: 1.0,
    voice_speed: 1.0,
    volume: 1.0,
    pronunciation_dict: {} as Record<string, string>,
    normalize_for_speech: true,
    
    // Interaction
    backchanneling_enabled: true,
    backchanneling_frequency: 0.8,
    backchanneling_words: [] as string[],
    responsiveness: 1.0,
    interruption_sensitivity: 1.0,
    ambient_sound_enabled: false,
    ambient_sound_url: '',
    boosted_keywords: [] as string[],
    silence_reminders_enabled: true,
    silence_timeout: 10,
    
    // Call Handling
    voicemail_detection_enabled: true,
    voicemail_behavior: 'hangup' as 'hangup' | 'leave_message',
    voicemail_message: '',
    voicemail_message_type: 'static' as 'static' | 'prompt_generated',
    end_call_on_silence: true,
    end_call_silence_timeout: 30,
    max_call_duration: 1800, // 30 minutes
    pause_before_first_message: 1.0,
    dtmf_enabled: false,
    dtmf_digit_limit: 10,
    dtmf_termination_key: '#',
    dtmf_timeout: 5,
    
    // Knowledge Base
    kb_ids: [] as string[],
    
    // Transfer Settings
    transfer_mode: 'disabled' as 'disabled' | 'warm' | 'cold',
    transfer_number: '',
    transfer_message: '',
    
    // Custom Functions/Tools
    custom_tools: [] as Array<{
      id: string
      name: string
      description: string
      endpoint_url: string
      http_method: 'GET' | 'POST' | 'PUT' | 'DELETE'
      headers: Record<string, string>
      parameters: Array<{
        name: string
        type: 'string' | 'number' | 'boolean'
        required: boolean
        description: string
      }>
    }>,
    
    // Dynamic Variables
    dynamic_variables: [] as Array<{
      id: string
      name: string
      type: 'greeting' | 'voicemail' | 'transfer_target' | 'custom'
      value: string
      description: string
    }>,
  })
  const [saving, setSaving] = useState(false)
  const [newPronunciation, setNewPronunciation] = useState({ word: '', pronunciation: '' })
  const [newTool, setNewTool] = useState({
    name: '',
    description: '',
    endpoint_url: '',
    http_method: 'POST' as const,
    headers: {} as Record<string, string>,
    parameters: [] as Array<{
      name: string
      type: 'string' | 'number' | 'boolean'
      required: boolean
      description: string
    }>
  })
  const [newVariable, setNewVariable] = useState({
    name: '',
    type: 'custom' as const,
    value: '',
    description: ''
  })

  useEffect(() => {
    if (agents && agentId) {
      const foundAgent = agents.find(a => a.id === agentId)
      if (foundAgent) {
        setAgent(foundAgent)
        setSettings({
          name: foundAgent.name,
          type: 'prompt', // Default since we don't have flow type in schema
          language: foundAgent.language,
          multilingual: foundAgent.language === 'multilingual',
          prompt: '', // Would come from agent prompt data
          llm_model: 'gpt-4',
          temperature: 0.7,
          voice_id: foundAgent.voice_id || '',
          voice_model: foundAgent.voice_model || '',
          voice_temperature: foundAgent.voice_temperature || 1.0,
          voice_speed: foundAgent.voice_speed || 1.0,
          volume: foundAgent.volume || 1.0,
          pronunciation_dict: foundAgent.pronunciation_dict || {},
          normalize_for_speech: foundAgent.normalize_for_speech,
          
          // Interaction defaults
          backchanneling_enabled: true,
          backchanneling_frequency: 0.8,
          backchanneling_words: [],
          responsiveness: 1.0,
          interruption_sensitivity: 1.0,
          ambient_sound_enabled: false,
          ambient_sound_url: '',
          boosted_keywords: [],
          silence_reminders_enabled: true,
          silence_timeout: 10,
          
          // Call Handling defaults
          voicemail_detection_enabled: true,
          voicemail_behavior: 'hangup' as 'hangup' | 'leave_message',
          voicemail_message: '',
          voicemail_message_type: 'static' as 'static' | 'prompt_generated',
          end_call_on_silence: true,
          end_call_silence_timeout: 30,
          max_call_duration: 1800,
          pause_before_first_message: 1.0,
          dtmf_enabled: false,
          dtmf_digit_limit: 10,
          dtmf_termination_key: '#',
          dtmf_timeout: 5,
          
          // Knowledge Base
          kb_ids: foundAgent.kb_ids || [],
          
          // Transfer Settings
          transfer_mode: (foundAgent.transfer_mode as 'disabled' | 'warm' | 'cold') || 'disabled',
          transfer_number: foundAgent.transfer_number || '',
          transfer_message: '',
          
          // Custom Functions/Tools
          custom_tools: [],
          
          // Dynamic Variables
          dynamic_variables: [],
        })
      }
    }
  }, [agents, agentId])

  useEffect(() => {
    if (organization?.id) {
      loadVoices()
    }
  }, [organization?.id, loadVoices])

  const handleSave = async () => {
    if (!agent) return
    
    setSaving(true)
    try {
      const updates = {
        name: settings.name,
        language: settings.multilingual ? 'multilingual' : settings.language,
        voice_id: settings.voice_id,
        voice_model: settings.voice_model,
        voice_temperature: settings.voice_temperature,
        voice_speed: settings.voice_speed,
        volume: settings.volume,
        pronunciation_dict: settings.pronunciation_dict,
        normalize_for_speech: settings.normalize_for_speech,
      }

      await updateAgent(agent.id, updates)
      
      toast({
        title: "Settings saved",
        description: "Agent settings have been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save agent settings.",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAddPronunciation = () => {
    if (newPronunciation.word && newPronunciation.pronunciation) {
      setSettings(prev => ({
        ...prev,
        pronunciation_dict: {
          ...prev.pronunciation_dict,
          [newPronunciation.word]: newPronunciation.pronunciation
        }
      }))
      setNewPronunciation({ word: '', pronunciation: '' })
    }
  }

  const handleRemovePronunciation = (word: string) => {
    setSettings(prev => {
      const newDict = { ...prev.pronunciation_dict }
      delete newDict[word]
      return { ...prev, pronunciation_dict: newDict }
    })
  }

  const playVoicePreview = async () => {
    // TODO: Implement voice preview functionality
    toast({
      title: "Voice Preview",
      description: "Voice preview would play here.",
    })
  }

  const handleAddTool = () => {
    if (newTool.name && newTool.endpoint_url) {
      const tool = {
        id: Date.now().toString(),
        ...newTool,
        headers: newTool.headers || {},
        parameters: newTool.parameters || []
      }
      setSettings(prev => ({
        ...prev,
        custom_tools: [...prev.custom_tools, tool]
      }))
      setNewTool({
        name: '',
        description: '',
        endpoint_url: '',
        http_method: 'POST',
        headers: {},
        parameters: []
      })
    }
  }

  const handleRemoveTool = (toolId: string) => {
    setSettings(prev => ({
      ...prev,
      custom_tools: prev.custom_tools.filter(tool => tool.id !== toolId)
    }))
  }

  const handleAddVariable = () => {
    if (newVariable.name && newVariable.value) {
      const variable = {
        id: Date.now().toString(),
        ...newVariable
      }
      setSettings(prev => ({
        ...prev,
        dynamic_variables: [...prev.dynamic_variables, variable]
      }))
      setNewVariable({
        name: '',
        type: 'custom',
        value: '',
        description: ''
      })
    }
  }

  const handleRemoveVariable = (variableId: string) => {
    setSettings(prev => ({
      ...prev,
      dynamic_variables: prev.dynamic_variables.filter(variable => variable.id !== variableId)
    }))
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading agent settings...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Agent Settings
          </h1>
          <p className="text-muted-foreground">
            Configure settings for "{agent.name}"
          </p>
        </div>
        <div className="ml-auto">
          <Badge variant={agent.status === 'published' ? 'default' : 'secondary'}>
            {agent.status}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="basics" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basics" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Basics
          </TabsTrigger>
          <TabsTrigger value="voice" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Voice
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Knowledge
          </TabsTrigger>
          <TabsTrigger value="transfers" className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4" />
            Transfers
          </TabsTrigger>
          <TabsTrigger value="interaction" className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Interaction
          </TabsTrigger>
          <TabsTrigger value="call-handling" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Call Handling
          </TabsTrigger>
        </TabsList>

        {/* Basics Tab */}
        <TabsContent value="basics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Agent Identity</CardTitle>
              <CardDescription>
                Configure the basic identity and behavior of your agent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Agent Name</Label>
                  <Input
                    id="name"
                    value={settings.name}
                    onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter agent name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Agent Type</Label>
                  <Select value={settings.type} onValueChange={(value) => setSettings(prev => ({ ...prev, type: value as any }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prompt">Prompt-based</SelectItem>
                      <SelectItem value="flow">Flow-based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {settings.type === 'prompt' && (
                <div className="space-y-2">
                  <Label htmlFor="prompt">Global Prompt/Persona</Label>
                  <Textarea
                    id="prompt"
                    value={settings.prompt}
                    onChange={(e) => setSettings(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="Define your agent's personality, role, and behavior..."
                    rows={6}
                  />
                  <p className="text-sm text-muted-foreground">
                    This prompt defines how your agent behaves and responds to users.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Language Settings</CardTitle>
              <CardDescription>
                Configure the language capabilities of your agent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Multilingual Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable automatic language detection for multiple languages
                  </p>
                </div>
                <Switch
                  checked={settings.multilingual}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, multilingual: checked }))}
                />
              </div>

              {!settings.multilingual && (
                <div className="space-y-2">
                  <Label htmlFor="language">Primary Language</Label>
                  <Select value={settings.language} onValueChange={(value) => setSettings(prev => ({ ...prev, language: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="it">Italian</SelectItem>
                      <SelectItem value="pt">Portuguese</SelectItem>
                      <SelectItem value="nl">Dutch</SelectItem>
                      <SelectItem value="pl">Polish</SelectItem>
                      <SelectItem value="ru">Russian</SelectItem>
                      <SelectItem value="ja">Japanese</SelectItem>
                      <SelectItem value="ko">Korean</SelectItem>
                      <SelectItem value="zh">Chinese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {settings.type === 'prompt' && (
            <Card>
              <CardHeader>
                <CardTitle>LLM Configuration</CardTitle>
                <CardDescription>
                  Configure the language model and its parameters.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="llm-model">LLM Model</Label>
                    <Select value={settings.llm_model} onValueChange={(value) => setSettings(prev => ({ ...prev, llm_model: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                        <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                        <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="temperature">Temperature: {settings.temperature}</Label>
                    <Slider
                      value={[settings.temperature]}
                      onValueChange={(value) => setSettings(prev => ({ ...prev, temperature: value[0] }))}
                      max={2}
                      min={0}
                      step={0.1}
                      className="w-full"
                    />
                    <p className="text-sm text-muted-foreground">
                      Higher values make responses more creative, lower values more focused
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Voice Tab */}
        <TabsContent value="voice" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Voice Selection</CardTitle>
              <CardDescription>
                Choose and preview the voice for your agent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="voice">Voice</Label>
                  <Select value={settings.voice_id} onValueChange={(value) => setSettings(prev => ({ ...prev, voice_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {voices?.map((voice) => (
                        <SelectItem key={voice.voice_id} value={voice.voice_id}>
                          <div className="flex items-center gap-2">
                            <span>{voice.voice_name}</span>
                            <Badge variant="outline" className="text-xs">
                              {voice.gender}
                            </Badge>
                            {voice.accent && (
                              <Badge variant="outline" className="text-xs">
                                {voice.accent}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="voice-model">Voice Model</Label>
                  <Select value={settings.voice_model} onValueChange={(value) => setSettings(prev => ({ ...prev, voice_model: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select voice model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eleven_turbo_v2">Eleven Turbo v2</SelectItem>
                      <SelectItem value="eleven_multilingual_v2">Eleven Multilingual v2</SelectItem>
                      <SelectItem value="eleven_monolingual_v1">Eleven English v1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={playVoicePreview}
                  disabled={!settings.voice_id}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Preview Voice
                </Button>
                {settings.voice_id && (
                  <p className="text-sm text-muted-foreground">
                    Click to hear a sample of the selected voice
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Voice Tuning</CardTitle>
              <CardDescription>
                Fine-tune voice characteristics for optimal performance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="voice-temperature">Voice Temperature: {settings.voice_temperature}</Label>
                  <Slider
                    value={[settings.voice_temperature]}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, voice_temperature: value[0] }))}
                    max={2}
                    min={0}
                    step={0.1}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    Controls voice expressiveness
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="voice-speed">Voice Speed: {settings.voice_speed}x</Label>
                  <Slider
                    value={[settings.voice_speed]}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, voice_speed: value[0] }))}
                    max={2}
                    min={0.25}
                    step={0.05}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    Speaking rate multiplier
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="volume">Volume: {Math.round(settings.volume * 100)}%</Label>
                  <Slider
                    value={[settings.volume]}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, volume: value[0] }))}
                    max={2}
                    min={0}
                    step={0.1}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    Output volume level
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Speech Processing</CardTitle>
              <CardDescription>
                Configure how text is processed before speech synthesis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Speech Normalization</Label>
                  <p className="text-sm text-muted-foreground">
                    Convert numbers, currency, dates to spoken form (e.g., "$100" → "one hundred dollars")
                  </p>
                </div>
                <Switch
                  checked={settings.normalize_for_speech}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, normalize_for_speech: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pronunciation Dictionary</CardTitle>
              <CardDescription>
                Add custom pronunciations for specific words (IPA/CMU format for eligible voices).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="word">Word</Label>
                  <Input
                    id="word"
                    value={newPronunciation.word}
                    onChange={(e) => setNewPronunciation(prev => ({ ...prev, word: e.target.value }))}
                    placeholder="e.g., Retell"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="pronunciation">Pronunciation (IPA/CMU)</Label>
                  <Input
                    id="pronunciation"
                    value={newPronunciation.pronunciation}
                    onChange={(e) => setNewPronunciation(prev => ({ ...prev, pronunciation: e.target.value }))}
                    placeholder="e.g., /rɪˈtɛl/"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleAddPronunciation}
                    disabled={!newPronunciation.word || !newPronunciation.pronunciation}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {Object.keys(settings.pronunciation_dict).length > 0 && (
                <div className="space-y-2">
                  <Label>Custom Pronunciations</Label>
                  <div className="space-y-2">
                    {Object.entries(settings.pronunciation_dict).map(([word, pronunciation]) => (
                      <div key={word} className="flex items-center justify-between p-3 border rounded-md">
                        <div>
                          <span className="font-medium">{word}</span>
                          <span className="text-muted-foreground ml-2">{pronunciation}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemovePronunciation(word)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Tab */}
        <TabsContent value="knowledge" className="space-y-6">
          {agent && (
            <KnowledgeBaseView 
              agent={{
                id: agent.id,
                slug: agent.agent_id,
                name: agent.name,
                category: 'voice-agent',
                subtitle: 'AI Voice Agent',
                description: agent.name,
                tags: [],
                kb_ids: settings.kb_ids
              }}
            />
          )}
        </TabsContent>

        {/* Transfers Tab */}
        <TabsContent value="transfers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Human Transfer Settings</CardTitle>
              <CardDescription>
                Configure how calls are transferred to human agents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="transfer-mode">Transfer Mode</Label>
                <Select value={settings.transfer_mode} onValueChange={(value) => setSettings(prev => ({ ...prev, transfer_mode: value as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Disabled</SelectItem>
                    <SelectItem value="warm">Warm Transfer</SelectItem>
                    <SelectItem value="cold">Cold Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.transfer_mode !== 'disabled' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="transfer-number">Transfer Number</Label>
                    <Input
                      id="transfer-number"
                      value={settings.transfer_number}
                      onChange={(e) => setSettings(prev => ({ ...prev, transfer_number: e.target.value }))}
                      placeholder="+1234567890"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transfer-message">Transfer Message</Label>
                    <Textarea
                      id="transfer-message"
                      value={settings.transfer_message}
                      onChange={(e) => setSettings(prev => ({ ...prev, transfer_message: e.target.value }))}
                      placeholder="Let me connect you with a human agent who can better assist you..."
                      rows={3}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custom Functions & Tools</CardTitle>
              <CardDescription>
                Add custom HTTP endpoints that your agent can call during conversations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.custom_tools.length === 0 ? (
                <div className="text-center py-8">
                  <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Custom Tools Configured</h3>
                  <p className="text-muted-foreground mb-4">
                    Custom tools allow your agent to perform actions like API calls, database queries, or webhook notifications.
                  </p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Custom Tool
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Add Custom Tool</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="tool-name">Tool Name</Label>
                            <Input
                              id="tool-name"
                              value={newTool.name}
                              onChange={(e) => setNewTool(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="e.g., Create Calendar Event"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="http-method">HTTP Method</Label>
                            <Select value={newTool.http_method} onValueChange={(value) => setNewTool(prev => ({ ...prev, http_method: value as any }))}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GET">GET</SelectItem>
                                <SelectItem value="POST">POST</SelectItem>
                                <SelectItem value="PUT">PUT</SelectItem>
                                <SelectItem value="DELETE">DELETE</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="tool-description">Description</Label>
                          <Textarea
                            id="tool-description"
                            value={newTool.description}
                            onChange={(e) => setNewTool(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Describe what this tool does..."
                            rows={2}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="endpoint-url">Endpoint URL</Label>
                          <Input
                            id="endpoint-url"
                            value={newTool.endpoint_url}
                            onChange={(e) => setNewTool(prev => ({ ...prev, endpoint_url: e.target.value }))}
                            placeholder="https://api.example.com/endpoint"
                          />
                        </div>
                        
                        <Button onClick={handleAddTool} className="w-full">
                          Add Tool
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : (
                settings.custom_tools.map(tool => (
                  <div key={tool.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        <span className="font-medium">{tool.name}</span>
                        <Badge variant="outline">{tool.http_method}</Badge>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveTool(tool.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{tool.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ExternalLink className="h-3 w-3" />
                      {tool.endpoint_url}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dynamic Variables</CardTitle>
              <CardDescription>
                Create variables for greetings, voicemail messages, transfer targets, and more.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.dynamic_variables.length === 0 ? (
                <div className="text-center py-6">
                  <h3 className="text-lg font-medium mb-2">No Variables Defined</h3>
                  <p className="text-muted-foreground mb-4">
                    Variables help personalize interactions and make maintenance easier.
                  </p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Variable
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Dynamic Variable</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="var-name">Variable Name</Label>
                            <Input
                              id="var-name"
                              value={newVariable.name}
                              onChange={(e) => setNewVariable(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="e.g., company_name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="var-type">Type</Label>
                            <Select value={newVariable.type} onValueChange={(value) => setNewVariable(prev => ({ ...prev, type: value as any }))}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="greeting">Greeting</SelectItem>
                                <SelectItem value="voicemail">Voicemail</SelectItem>
                                <SelectItem value="transfer_target">Transfer Target</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="var-value">Value</Label>
                          <Input
                            id="var-value"
                            value={newVariable.value}
                            onChange={(e) => setNewVariable(prev => ({ ...prev, value: e.target.value }))}
                            placeholder="Enter variable value..."
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="var-description">Description</Label>
                          <Input
                            id="var-description"
                            value={newVariable.description}
                            onChange={(e) => setNewVariable(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Describe this variable..."
                          />
                        </div>
                        
                        <Button onClick={handleAddVariable} className="w-full">
                          Add Variable
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : (
                settings.dynamic_variables.map(variable => (
                  <div key={variable.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{variable.name}</span>
                        <Badge variant="outline">{variable.type}</Badge>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveVariable(variable.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{variable.description}</p>
                    <p className="text-sm font-mono bg-muted px-2 py-1 rounded">{variable.value}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interaction Tab */}
        <TabsContent value="interaction" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Backchanneling</CardTitle>
              <CardDescription>
                Configure how the agent provides conversational feedback.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Enable Backchanneling</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow agent to use "mm-hmm", "I see", etc. during conversation
                  </p>
                </div>
                <Switch
                  checked={settings.backchanneling_enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, backchanneling_enabled: checked }))}
                />
              </div>

              {settings.backchanneling_enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="backchanneling-frequency">Frequency: {settings.backchanneling_frequency}</Label>
                    <Slider
                      value={[settings.backchanneling_frequency]}
                      onValueChange={(value) => setSettings(prev => ({ ...prev, backchanneling_frequency: value[0] }))}
                      max={2}
                      min={0.1}
                      step={0.1}
                      className="w-full"
                    />
                    <p className="text-sm text-muted-foreground">
                      How often the agent provides feedback (lower = less frequent)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="backchanneling-words">Custom Backchanneling Words</Label>
                    <Input
                      id="backchanneling-words"
                      value={settings.backchanneling_words.join(', ')}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        backchanneling_words: e.target.value.split(',').map(w => w.trim()).filter(w => w) 
                      }))}
                      placeholder="mm-hmm, I see, okay, right"
                    />
                    <p className="text-sm text-muted-foreground">
                      Comma-separated list of custom backchanneling words
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Response Behavior</CardTitle>
              <CardDescription>
                Control how quickly and sensitively the agent responds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="responsiveness">Responsiveness: {settings.responsiveness}x</Label>
                  <Slider
                    value={[settings.responsiveness]}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, responsiveness: value[0] }))}
                    max={2}
                    min={0.1}
                    step={0.1}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    Higher = faster replies, Lower = more thoughtful pauses
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interruption-sensitivity">Interruption Sensitivity: {settings.interruption_sensitivity}x</Label>
                  <Slider
                    value={[settings.interruption_sensitivity]}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, interruption_sensitivity: value[0] }))}
                    max={2}
                    min={0.1}
                    step={0.1}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    How easily the agent yields when interrupted
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Background & Enhancement</CardTitle>
              <CardDescription>
                Configure ambient sounds and speech recognition improvements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Background Sound</Label>
                  <p className="text-sm text-muted-foreground">
                    Add optional ambient background sound
                  </p>
                </div>
                <Switch
                  checked={settings.ambient_sound_enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, ambient_sound_enabled: checked }))}
                />
              </div>

              {settings.ambient_sound_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="ambient-sound-url">Sound URL</Label>
                  <Input
                    id="ambient-sound-url"
                    value={settings.ambient_sound_url}
                    onChange={(e) => setSettings(prev => ({ ...prev, ambient_sound_url: e.target.value }))}
                    placeholder="https://example.com/ambient-sound.mp3"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="boosted-keywords">Boosted Keywords</Label>
                <Input
                  id="boosted-keywords"
                  value={settings.boosted_keywords.join(', ')}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    boosted_keywords: e.target.value.split(',').map(w => w.trim()).filter(w => w) 
                  }))}
                  placeholder="YourBrand, ProductName, SpecialTerm"
                />
                <p className="text-sm text-muted-foreground">
                  Help speech recognition catch brand names and special terms
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Silence Handling</CardTitle>
              <CardDescription>
                Configure how the agent handles user silence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Silence Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Gentle follow-ups during user inactivity
                  </p>
                </div>
                <Switch
                  checked={settings.silence_reminders_enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, silence_reminders_enabled: checked }))}
                />
              </div>

              {settings.silence_reminders_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="silence-timeout">Silence Timeout: {settings.silence_timeout}s</Label>
                  <Slider
                    value={[settings.silence_timeout]}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, silence_timeout: value[0] }))}
                    max={60}
                    min={3}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    How long to wait before prompting the user
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Call Handling Tab */}
        <TabsContent value="call-handling" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Voicemail Detection</CardTitle>
              <CardDescription>
                Configure how the agent handles voicemail detection.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Enable Voicemail Detection</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically detect when calls go to voicemail
                  </p>
                </div>
                <Switch
                  checked={settings.voicemail_detection_enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, voicemail_detection_enabled: checked }))}
                />
              </div>

              {settings.voicemail_detection_enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="voicemail-behavior">Voicemail Behavior</Label>
                    <Select value={settings.voicemail_behavior} onValueChange={(value) => setSettings(prev => ({ ...prev, voicemail_behavior: value as any }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hangup">Hang Up</SelectItem>
                        <SelectItem value="leave_message">Leave Message</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {settings.voicemail_behavior === 'leave_message' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="voicemail-message-type">Message Type</Label>
                        <Select value={settings.voicemail_message_type} onValueChange={(value) => setSettings(prev => ({ ...prev, voicemail_message_type: value as any }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="static">Static Message</SelectItem>
                            <SelectItem value="prompt_generated">Prompt Generated</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {settings.voicemail_message_type === 'static' && (
                        <div className="space-y-2">
                          <Label htmlFor="voicemail-message">Voicemail Message</Label>
                          <Textarea
                            id="voicemail-message"
                            value={settings.voicemail_message}
                            onChange={(e) => setSettings(prev => ({ ...prev, voicemail_message: e.target.value }))}
                            placeholder="Hi, this is [Agent Name]. I'll call you back soon..."
                            rows={3}
                          />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Call Duration & Timeouts</CardTitle>
              <CardDescription>
                Set limits and timeouts for call handling.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">End Call on Silence</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically end calls after extended silence
                  </p>
                </div>
                <Switch
                  checked={settings.end_call_on_silence}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, end_call_on_silence: checked }))}
                />
              </div>

              {settings.end_call_on_silence && (
                <div className="space-y-2">
                  <Label htmlFor="end-call-silence-timeout">Silence Timeout: {settings.end_call_silence_timeout}s</Label>
                  <Slider
                    value={[settings.end_call_silence_timeout]}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, end_call_silence_timeout: value[0] }))}
                    max={300}
                    min={10}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    Seconds of silence before ending the call
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="max-call-duration">Max Call Duration: {Math.round(settings.max_call_duration / 60)} minutes</Label>
                <Slider
                  value={[settings.max_call_duration]}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, max_call_duration: value[0] }))}
                  max={7200} // 2 hours
                  min={300} // 5 minutes
                  step={300} // 5 minute steps
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Maximum duration for any single call
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pause-before-first-message">Pause Before First Message: {settings.pause_before_first_message}s</Label>
                <Slider
                  value={[settings.pause_before_first_message]}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, pause_before_first_message: value[0] }))}
                  max={5}
                  min={0}
                  step={0.1}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Wait time to avoid talking over caller's greeting
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>DTMF Options</CardTitle>
              <CardDescription>
                Configure keypad input settings for interactive prompts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Enable DTMF</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow users to input digits via keypad
                  </p>
                </div>
                <Switch
                  checked={settings.dtmf_enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, dtmf_enabled: checked }))}
                />
              </div>

              {settings.dtmf_enabled && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="dtmf-digit-limit">Digit Limit</Label>
                    <Input
                      id="dtmf-digit-limit"
                      type="number"
                      value={settings.dtmf_digit_limit}
                      onChange={(e) => setSettings(prev => ({ ...prev, dtmf_digit_limit: parseInt(e.target.value) || 10 }))}
                      min={1}
                      max={50}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dtmf-termination-key">Termination Key</Label>
                    <Select value={settings.dtmf_termination_key} onValueChange={(value) => setSettings(prev => ({ ...prev, dtmf_termination_key: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="#"># (Hash)</SelectItem>
                        <SelectItem value="*">* (Star)</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dtmf-timeout">Timeout: {settings.dtmf_timeout}s</Label>
                    <Slider
                      value={[settings.dtmf_timeout]}
                      onValueChange={(value) => setSettings(prev => ({ ...prev, dtmf_timeout: value[0] }))}
                      max={30}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}