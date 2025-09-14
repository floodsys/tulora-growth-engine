import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ArrowLeft, Save, Undo2, Play, Upload, Volume2, Settings, Shield, Phone, MessageSquare } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface RetellAgent {
  id: string
  organization_id: string
  agent_id: string
  name: string
  version: number
  // Basic settings
  agent_type?: 'prompt' | 'flow'
  response_engine?: string
  llm_model?: string
  llm_temperature?: number
  // Voice settings
  voice_id?: string
  voice_model?: string
  language: string
  languages?: string[]  // for multi-language support
  auto_detect_language?: boolean
  // Audio tuning
  backchannel_enabled: boolean
  backchannel_frequency: number
  pronunciation_dict: any
  voice_speed: number
  voice_temperature: number
  volume: number
  normalize_for_speech: boolean
  // Prompts and behavior
  global_prompt?: string
  first_message?: string
  // Call settings
  max_call_duration_ms: number
  end_call_after_silence_ms: number
  begin_message_delay_ms: number
  voicemail_option: string
  // Privacy and integrations
  data_storage_setting: string
  opt_in_signed_url: boolean
  webhook_url?: string
  transfer_number?: string
  transfer_mode: string
  kb_ids: string[]
  status: string
  published_at?: string
}

interface Voice {
  voice_id: string
  voice_name: string
  gender: string
  accent: string
  provider?: string
  model?: string
  description?: string
  preview_url?: string
}

interface LLMModel {
  id: string
  name: string
  provider: string
  description?: string
}

const RetellAgentSettings = () => {
  const { agentId } = useParams<{ agentId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [agent, setAgent] = useState<RetellAgent | null>(null)
  const [voices, setVoices] = useState<Voice[]>([])
  const [llmModels] = useState<LLMModel[]>([
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', description: 'Most capable model' },
    { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', description: 'High quality responses' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', description: 'Fast and efficient' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', description: 'Advanced reasoning' },
    { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic', description: 'Balanced performance' }
  ])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [organizationId, setOrganizationId] = useState<string>('')

  const form = useForm<RetellAgent>()

  // Load agent data
  useEffect(() => {
    if (!agentId) return

    const loadAgent = async () => {
      try {
        const { data, error } = await supabase
          .from('retell_agents')
          .select('*')
          .eq('agent_id', agentId)
          .single()

        if (error) throw error

        setAgent(data)
        setOrganizationId(data.organization_id)
        form.reset(data)
      } catch (error) {
        console.error('Error loading agent:', error)
        toast({
          title: "Error",
          description: "Failed to load agent settings.",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    loadAgent()
  }, [agentId, form, toast])

  // Load voices
  useEffect(() => {
    if (!organizationId) return

    const loadVoices = async () => {
      setVoicesLoading(true)
      try {
        const { data, error } = await supabase.functions.invoke('retell-voices-list', {
          body: { organizationId }
        })

        if (error) throw error

        setVoices(data.voices || [])
      } catch (error) {
        console.error('Error loading voices:', error)
        toast({
          title: "Warning",
          description: "Could not load available voices.",
          variant: "destructive"
        })
      } finally {
        setVoicesLoading(false)
      }
    }

    loadVoices()
  }, [organizationId, toast])

  // Watch for form changes
  useEffect(() => {
    const subscription = form.watch(() => {
      setHasUnsavedChanges(true)
    })
    return () => subscription.unsubscribe()
  }, [form])

  // Handle save
  const handleSave = async () => {
    if (!agent) return

    setSaving(true)
    try {
      const formData = form.getValues()
      
      const { error } = await supabase
        .from('retell_agents')
        .update({
          ...formData,
          updated_at: new Date().toISOString()
        })
        .eq('id', agent.id)

      if (error) throw error

      const updatedAgent = { ...agent, ...formData }
      setAgent(updatedAgent)
      setHasUnsavedChanges(false)

      toast({
        title: "Settings Saved",
        description: "Agent settings have been updated successfully.",
      })
    } catch (error) {
      console.error('Error saving agent:', error)
      toast({
        title: "Error",
        description: "Failed to save agent settings. Please try again.",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  // Handle publish
  const handlePublish = async () => {
    if (!agent) return

    setPublishing(true)
    try {
      const { data, error } = await supabase.functions.invoke('retell-agents-publish', {
        body: { 
          agentId: agent.agent_id,
          organizationId: agent.organization_id
        }
      })

      if (error) throw error

      setAgent(prev => prev ? { 
        ...prev, 
        status: 'published',
        version: data.version,
        published_at: new Date().toISOString()
      } : null)

      toast({
        title: "Agent Published",
        description: `Agent published successfully as version ${data.version}.`,
      })
    } catch (error) {
      console.error('Error publishing agent:', error)
      toast({
        title: "Error",
        description: "Failed to publish agent. Please try again.",
        variant: "destructive"
      })
    } finally {
      setPublishing(false)
    }
  }

  // Handle voice preview
  const playVoicePreview = async (voiceId: string, previewUrl?: string) => {
    if (!previewUrl) return
    
    try {
      const audio = new Audio(previewUrl)
      await audio.play()
    } catch (error) {
      console.error('Error playing voice preview:', error)
      toast({
        title: "Warning",
        description: "Could not play voice preview.",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading agent settings...</p>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Agent Not Found</h1>
          <p className="text-muted-foreground mb-6">The requested agent could not be found.</p>
          <Button onClick={() => navigate('/dashboard?tab=agents')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Agents
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (hasUnsavedChanges) {
                    const shouldLeave = confirm("You have unsaved changes. Are you sure you want to leave?")
                    if (!shouldLeave) return
                  }
                  navigate("/dashboard?tab=agents")
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{agent.name}</h1>
                <div className="flex items-center space-x-3 mt-1">
                  <p className="text-muted-foreground">Retell Agent Configuration</p>
                  <Badge variant={agent.status === 'published' ? 'default' : 'secondary'}>
                    {agent.status === 'published' ? `v${agent.version}` : 'Draft'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={handlePublish}
                disabled={publishing}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {publishing ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Publish
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <form>
          <Accordion type="single" collapsible className="space-y-4" defaultValue="basic">
            
            {/* Basic Settings */}
            <AccordionItem value="basic" className="border rounded-lg">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center">
                  <Settings className="h-5 w-5 mr-3 text-primary" />
                  <span className="font-semibold">Basic Settings</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  {/* Agent Type and Response Engine */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="agent_type">Agent Type</Label>
                      <Select 
                        value={form.watch("agent_type") || "prompt"} 
                        onValueChange={(value: 'prompt' | 'flow') => form.setValue("agent_type", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select agent type" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-md">
                          <SelectItem value="prompt">Prompt-based</SelectItem>
                          <SelectItem value="flow">Conversation Flow</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground mt-1">
                        Choose between AI prompt-based responses or structured conversation flows
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="name">Agent Name</Label>
                      <Input
                        id="name"
                        {...form.register("name")}
                        placeholder="Enter agent name"
                      />
                    </div>
                  </div>

                  {/* LLM Configuration (only for prompt-based agents) */}
                  {form.watch("agent_type") === "prompt" && (
                    <div className="space-y-4 p-4 bg-muted/20 rounded-lg">
                      <h4 className="font-medium">Response Engine Configuration</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="llm_model">LLM Model</Label>
                          <Select 
                            value={form.watch("llm_model") || "gpt-4-turbo"} 
                            onValueChange={(value) => form.setValue("llm_model", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select LLM model" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-md">
                              {llmModels.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                  <div>
                                    <div className="font-medium">{model.name}</div>
                                    <div className="text-sm text-muted-foreground">{model.provider} • {model.description}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>LLM Temperature: {form.watch("llm_temperature")?.toFixed(1) || "0.7"}</Label>
                          <Slider
                            value={[form.watch("llm_temperature") || 0.7]}
                            onValueChange={([value]) => form.setValue("llm_temperature", value)}
                            min={0.0}
                            max={2.0}
                            step={0.1}
                            className="mt-2"
                          />
                          <p className="text-sm text-muted-foreground mt-1">
                            Higher values make responses more creative, lower values more focused
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Language Settings */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-detect Language</Label>
                        <p className="text-sm text-muted-foreground">Automatically detect caller's language</p>
                      </div>
                      <Switch
                        checked={form.watch("auto_detect_language")}
                        onCheckedChange={(checked) => form.setValue("auto_detect_language", checked)}
                      />
                    </div>

                    {!form.watch("auto_detect_language") ? (
                      <div>
                        <Label htmlFor="language">Primary Language</Label>
                        <Select 
                          value={form.watch("language")} 
                          onValueChange={(value) => form.setValue("language", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-md">
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Spanish</SelectItem>
                            <SelectItem value="fr">French</SelectItem>
                            <SelectItem value="de">German</SelectItem>
                            <SelectItem value="it">Italian</SelectItem>
                            <SelectItem value="pt">Portuguese</SelectItem>
                            <SelectItem value="zh">Chinese</SelectItem>
                            <SelectItem value="ja">Japanese</SelectItem>
                            <SelectItem value="ko">Korean</SelectItem>
                            <SelectItem value="hi">Hindi</SelectItem>
                            <SelectItem value="ar">Arabic</SelectItem>
                            <SelectItem value="ru">Russian</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div>
                        <Label>Supported Languages</Label>
                        <p className="text-sm text-muted-foreground mb-2">
                          Agent will automatically detect and respond in these languages
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko'].map((lang) => (
                            <Badge key={lang} variant="outline">
                              {lang.toUpperCase()}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Prompt & Persona */}
            <AccordionItem value="prompt" className="border rounded-lg">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-3 text-primary" />
                  <span className="font-semibold">Prompt & Persona</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="global_prompt">Global Prompt</Label>
                    <Textarea
                      id="global_prompt"
                      {...form.register("global_prompt")}
                      placeholder="Define your agent's personality, role, and how it should behave during conversations..."
                      className="min-h-[120px]"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      This prompt defines your agent's personality and behavior throughout the conversation
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="first_message">First Message</Label>
                    <Textarea
                      id="first_message"
                      {...form.register("first_message")}
                      placeholder="Hi! How can I help you today?"
                      className="min-h-[80px]"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      The greeting message your agent will use to start conversations
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Voice Settings */}
            <AccordionItem value="voice" className="border rounded-lg">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center">
                  <Volume2 className="h-5 w-5 mr-3 text-primary" />
                  <span className="font-semibold">Voice & Audio Settings</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  {/* Voice Selection */}
                  <div className="space-y-4">
                    <div>
                      <Label>Voice Selection</Label>
                      <Select 
                        value={form.watch("voice_id") || ""} 
                        onValueChange={(value) => form.setValue("voice_id", value)}
                        disabled={voicesLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={voicesLoading ? "Loading voices..." : "Select a voice"} />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-md max-h-60">
                          {voices.map((voice) => (
                            <SelectItem key={voice.voice_id} value={voice.voice_id}>
                              <div className="flex items-center justify-between w-full">
                                <div>
                                  <span className="font-medium">{voice.voice_name}</span>
                                  <span className="text-muted-foreground ml-2">
                                    ({voice.gender}, {voice.accent})
                                    {voice.provider && ` • ${voice.provider}`}
                                  </span>
                                </div>
                                {voice.preview_url && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      playVoicePreview(voice.voice_id, voice.preview_url)
                                    }}
                                  >
                                    <Play className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Voice Model Selection */}
                    <div>
                      <Label htmlFor="voice_model">Voice Model</Label>
                      <Select 
                        value={form.watch("voice_model") || ""} 
                        onValueChange={(value) => form.setValue("voice_model", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select voice model" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-md">
                          <SelectItem value="eleven_multilingual_v2">Eleven Multilingual v2 (High Quality)</SelectItem>
                          <SelectItem value="eleven_turbo_v2_5">Eleven Turbo v2.5 (Low Latency)</SelectItem>
                          <SelectItem value="eleven_turbo_v2">Eleven Turbo v2 (English Only)</SelectItem>
                          <SelectItem value="eleven_multilingual_v1">Eleven Multilingual v1 (Legacy)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground mt-1">
                        Choose the AI model for voice generation - impacts quality and latency
                      </p>
                    </div>
                  </div>

                  {/* Voice Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <Label>Voice Speed: {form.watch("voice_speed")?.toFixed(1)}x</Label>
                      <Slider
                        value={[form.watch("voice_speed") || 1.0]}
                        onValueChange={([value]) => form.setValue("voice_speed", value)}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label>Voice Temperature: {form.watch("voice_temperature")?.toFixed(1)}</Label>
                      <Slider
                        value={[form.watch("voice_temperature") || 1.0]}
                        onValueChange={([value]) => form.setValue("voice_temperature", value)}
                        min={0.0}
                        max={2.0}
                        step={0.1}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label>Volume: {form.watch("volume")?.toFixed(1)}</Label>
                      <Slider
                        value={[form.watch("volume") || 1.0]}
                        onValueChange={([value]) => form.setValue("volume", value)}
                        min={0.0}
                        max={2.0}
                        step={0.1}
                        className="mt-2"
                      />
                    </div>
                  </div>

                  {/* Voice Toggles */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Normalize for Speech</Label>
                        <p className="text-sm text-muted-foreground">Convert numbers, currency, dates to spoken form</p>
                      </div>
                      <Switch
                        checked={form.watch("normalize_for_speech")}
                        onCheckedChange={(checked) => form.setValue("normalize_for_speech", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Enable Backchannel</Label>
                        <p className="text-sm text-muted-foreground">Allow "mm-hmm" responses during conversation</p>
                      </div>
                      <Switch
                        checked={form.watch("backchannel_enabled")}
                        onCheckedChange={(checked) => form.setValue("backchannel_enabled", checked)}
                      />
                    </div>

                    {form.watch("backchannel_enabled") && (
                      <div>
                        <Label>Backchannel Frequency: {form.watch("backchannel_frequency")?.toFixed(2)}</Label>
                        <Slider
                          value={[form.watch("backchannel_frequency") || 0.8]}
                          onValueChange={([value]) => form.setValue("backchannel_frequency", value)}
                          min={0.0}
                          max={1.0}
                          step={0.01}
                          className="mt-2"
                        />
                      </div>
                    )}
                  </div>

                  {/* Pronunciation Dictionary */}
                  <div className="p-4 bg-muted/20 rounded-lg">
                    <h4 className="font-medium mb-3">Pronunciation Dictionary</h4>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="pronunciation_dict">Custom Pronunciations (JSON)</Label>
                        <Textarea
                          id="pronunciation_dict"
                          value={typeof form.watch("pronunciation_dict") === 'object' 
                            ? JSON.stringify(form.watch("pronunciation_dict"), null, 2)
                            : form.watch("pronunciation_dict") || ""
                          }
                          onChange={(e) => {
                            try {
                              const parsed = JSON.parse(e.target.value)
                              form.setValue("pronunciation_dict", parsed)
                            } catch {
                              form.setValue("pronunciation_dict", e.target.value)
                            }
                          }}
                          placeholder='{"API": "ay-pee-eye", "OAuth": "oh-auth"}'
                          className="min-h-[80px] font-mono text-sm"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Define custom pronunciations using IPA or CMU phonetic notation for better speech quality.
                        Example: {"{"}"API": "ay-pee-eye", "SQL": "sequel"{"}"}
                      </p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Call Behavior */}
            <AccordionItem value="behavior" className="border rounded-lg">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center">
                  <Phone className="h-5 w-5 mr-3 text-primary" />
                  <span className="font-semibold">Call Behavior & Timing</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="max_call_duration_ms">Max Call Duration (minutes)</Label>
                    <Input
                      id="max_call_duration_ms"
                      type="number"
                      value={Math.round((form.watch("max_call_duration_ms") || 1800000) / 60000)}
                      onChange={(e) => form.setValue("max_call_duration_ms", parseInt(e.target.value) * 60000)}
                      placeholder="30"
                    />
                  </div>

                  <div>
                    <Label htmlFor="end_call_after_silence_ms">End Call After Silence (seconds)</Label>
                    <Input
                      id="end_call_after_silence_ms"
                      type="number"
                      value={Math.round((form.watch("end_call_after_silence_ms") || 10000) / 1000)}
                      onChange={(e) => form.setValue("end_call_after_silence_ms", parseInt(e.target.value) * 1000)}
                      placeholder="10"
                    />
                  </div>

                  <div>
                    <Label htmlFor="begin_message_delay_ms">Begin Message Delay (ms)</Label>
                    <Input
                      id="begin_message_delay_ms"
                      type="number"
                      {...form.register("begin_message_delay_ms", { valueAsNumber: true })}
                      placeholder="800"
                    />
                  </div>

                  <div>
                    <Label htmlFor="voicemail_option">Voicemail Option</Label>
                    <Select 
                      value={form.watch("voicemail_option")} 
                      onValueChange={(value) => form.setValue("voicemail_option", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select voicemail option" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-md">
                        <SelectItem value="disabled">Disabled</SelectItem>
                        <SelectItem value="enabled">Enabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Transfer Settings */}
            <AccordionItem value="transfer" className="border rounded-lg">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center">
                  <Phone className="h-5 w-5 mr-3 text-primary" />
                  <span className="font-semibold">Call Transfer Settings</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="transfer_mode">Transfer Mode</Label>
                    <Select 
                      value={form.watch("transfer_mode")} 
                      onValueChange={(value) => form.setValue("transfer_mode", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select transfer mode" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-md">
                        <SelectItem value="disabled">Disabled</SelectItem>
                        <SelectItem value="warm">Warm Transfer</SelectItem>
                        <SelectItem value="cold">Cold Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.watch("transfer_mode") !== "disabled" && (
                    <div>
                      <Label htmlFor="transfer_number">Transfer Number</Label>
                      <Input
                        id="transfer_number"
                        {...form.register("transfer_number")}
                        placeholder="+1234567890"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Enter the phone number in E.164 format (e.g., +1234567890)
                      </p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Privacy & Storage */}
            <AccordionItem value="privacy" className="border rounded-lg">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center">
                  <Shield className="h-5 w-5 mr-3 text-primary" />
                  <span className="font-semibold">Privacy & Data Storage</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="data_storage_setting">Data Storage Setting</Label>
                    <Select 
                      value={form.watch("data_storage_setting")} 
                      onValueChange={(value) => form.setValue("data_storage_setting", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select storage setting" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-md">
                        <SelectItem value="standard">Standard Storage</SelectItem>
                        <SelectItem value="encrypted">Encrypted Storage</SelectItem>
                        <SelectItem value="minimal">Minimal Storage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Opt-in Signed URLs</Label>
                      <p className="text-sm text-muted-foreground">Require user consent for recording access</p>
                    </div>
                    <Switch
                      checked={form.watch("opt_in_signed_url")}
                      onCheckedChange={(checked) => form.setValue("opt_in_signed_url", checked)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="webhook_url">Webhook URL</Label>
                    <Input
                      id="webhook_url"
                      {...form.register("webhook_url")}
                      placeholder="https://your-domain.com/webhook"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Optional webhook URL for call events and transcripts
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </form>
      </div>

      {/* Sticky Save Actions */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 right-6 flex items-center space-x-3 bg-background border rounded-lg shadow-lg p-4">
          <Button
            variant="outline"
            onClick={() => {
              form.reset(agent)
              setHasUnsavedChanges(false)
            }}
            size="sm"
          >
            <Undo2 className="h-4 w-4 mr-2" />
            Revert
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
          >
            {saving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  )
}

export default RetellAgentSettings