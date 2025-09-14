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
import { ArrowLeft, Save, Undo2, Play, Upload, Volume2, Settings, Shield, Phone, MessageSquare, Mic, Clock, Database, Zap, Globe, BarChart3, Lock } from "lucide-react"
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
  // Interaction settings
  responsiveness?: number
  interruption_sensitivity?: number
  background_sound?: string
  boosted_keywords?: string[]
  silence_reminders?: boolean
  silence_reminder_interval?: number
  custom_backchannel_words?: string[]
  // DTMF settings
  dtmf_digit_limit?: number
  dtmf_termination_key?: string
  dtmf_timeout_ms?: number
  // Privacy and Storage
  secure_urls_enabled?: boolean
  transcript_retention_days?: number
  recording_retention_days?: number
  // Post-call Analysis
  analysis_enabled?: boolean
  analysis_model?: string
  custom_analysis_fields?: Array<{
    name: string
    type: 'boolean' | 'enum' | 'text' | 'json'
    options?: string[]
    description?: string
  }>
  analysis_webhook_url?: string
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

            {/* Interaction Settings */}
            <AccordionItem value="interaction" className="border rounded-lg">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center">
                  <Mic className="h-5 w-5 mr-3 text-primary" />
                  <span className="font-semibold">Interaction</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  
                  {/* Backchanneling Configuration */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Backchanneling</h4>
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
                      <div className="space-y-4 pl-4 border-l-2 border-muted">
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
                          <p className="text-sm text-muted-foreground mt-1">
                            How often the agent produces backchannel responses (0 = never, 1 = very frequent)
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="custom_backchannel_words">Custom Backchannel Words</Label>
                          <Input
                            id="custom_backchannel_words"
                            value={form.watch("custom_backchannel_words")?.join(", ") || ""}
                            onChange={(e) => {
                              const words = e.target.value.split(",").map(w => w.trim()).filter(w => w)
                              form.setValue("custom_backchannel_words", words)
                            }}
                            placeholder="mm-hmm, uh-huh, I see, right"
                          />
                          <p className="text-sm text-muted-foreground mt-1">
                            Comma-separated list of custom backchannel words and phrases
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Responsiveness and Interruption */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label>Responsiveness: {form.watch("responsiveness")?.toFixed(1) || "1.0"}</Label>
                      <Slider
                        value={[form.watch("responsiveness") || 1.0]}
                        onValueChange={([value]) => form.setValue("responsiveness", value)}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        className="mt-2"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Lower = slower, more thoughtful replies. Higher = faster responses
                      </p>
                    </div>

                    <div>
                      <Label>Interruption Sensitivity: {form.watch("interruption_sensitivity")?.toFixed(1) || "1.0"}</Label>
                      <Slider
                        value={[form.watch("interruption_sensitivity") || 1.0]}
                        onValueChange={([value]) => form.setValue("interruption_sensitivity", value)}
                        min={0.1}
                        max={2.0}
                        step={0.1}
                        className="mt-2"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Lower = harder to interrupt. Higher = easily yields to user speech
                      </p>
                    </div>
                  </div>

                  {/* Background Sound */}
                  <div>
                    <Label htmlFor="background_sound">Background Sound</Label>
                    <Select 
                      value={form.watch("background_sound") || "none"} 
                      onValueChange={(value) => form.setValue("background_sound", value === "none" ? undefined : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select background sound" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-md">
                        <SelectItem value="none">No Background Sound</SelectItem>
                        <SelectItem value="office">Office Ambience</SelectItem>
                        <SelectItem value="cafe">Café Ambience</SelectItem>
                        <SelectItem value="white_noise">White Noise</SelectItem>
                        <SelectItem value="nature">Nature Sounds</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-1">
                      Optional ambient background sound to enhance call atmosphere
                    </p>
                  </div>

                  {/* Boosted Keywords */}
                  <div>
                    <Label htmlFor="boosted_keywords">Boosted Keywords</Label>
                    <Textarea
                      id="boosted_keywords"
                      value={form.watch("boosted_keywords")?.join(", ") || ""}
                      onChange={(e) => {
                        const keywords = e.target.value.split(",").map(k => k.trim()).filter(k => k)
                        form.setValue("boosted_keywords", keywords)
                      }}
                      placeholder="YourBrand, ProductName, TechnicalTerms"
                      className="min-h-[80px]"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Comma-separated brand names, product names, or technical terms to help speech-to-text accuracy
                    </p>
                  </div>

                  {/* Silence Reminders */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Silence Reminders</Label>
                        <p className="text-sm text-muted-foreground">Send gentle follow-ups during user inactivity</p>
                      </div>
                      <Switch
                        checked={form.watch("silence_reminders")}
                        onCheckedChange={(checked) => form.setValue("silence_reminders", checked)}
                      />
                    </div>

                    {form.watch("silence_reminders") && (
                      <div className="pl-4 border-l-2 border-muted">
                        <Label>Reminder Interval: {form.watch("silence_reminder_interval") || 10}s</Label>
                        <Slider
                          value={[form.watch("silence_reminder_interval") || 10]}
                          onValueChange={([value]) => form.setValue("silence_reminder_interval", value)}
                          min={5}
                          max={60}
                          step={5}
                          className="mt-2"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          How often to send gentle reminders when user is silent
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Call Handling Settings */}
            <AccordionItem value="call-handling" className="border rounded-lg">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 mr-3 text-primary" />
                  <span className="font-semibold">Call Handling</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  
                  {/* Voicemail Settings */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Voicemail Detection & Behavior</h4>
                    <div>
                      <Label htmlFor="voicemail_option">Voicemail Behavior</Label>
                      <Select 
                        value={form.watch("voicemail_option") || "disabled"} 
                        onValueChange={(value) => form.setValue("voicemail_option", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select voicemail behavior" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-md">
                          <SelectItem value="disabled">Disabled</SelectItem>
                          <SelectItem value="hang_up">Hang Up on Voicemail</SelectItem>
                          <SelectItem value="leave_message">Leave Static Message</SelectItem>
                          <SelectItem value="prompt_generated">Leave AI-Generated Message</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground mt-1">
                        How the agent should behave when voicemail is detected
                      </p>
                    </div>
                  </div>

                  {/* Call Duration & Timeout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label>Max Call Duration: {Math.round((form.watch("max_call_duration_ms") || 1800000) / 60000)} min</Label>
                      <Slider
                        value={[form.watch("max_call_duration_ms") || 1800000]}
                        onValueChange={([value]) => form.setValue("max_call_duration_ms", value)}
                        min={60000}
                        max={3600000}
                        step={60000}
                        className="mt-2"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Maximum duration before call is automatically ended
                      </p>
                    </div>

                    <div>
                      <Label>End Call After Silence: {Math.round((form.watch("end_call_after_silence_ms") || 10000) / 1000)}s</Label>
                      <Slider
                        value={[form.watch("end_call_after_silence_ms") || 10000]}
                        onValueChange={([value]) => form.setValue("end_call_after_silence_ms", value)}
                        min={5000}
                        max={60000}
                        step={1000}
                        className="mt-2"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Automatically end call after this much silence
                      </p>
                    </div>
                  </div>

                  {/* First Message Delay */}
                  <div>
                    <Label>Pause Before First Message: {form.watch("begin_message_delay_ms") || 800}ms</Label>
                    <Slider
                      value={[form.watch("begin_message_delay_ms") || 800]}
                      onValueChange={([value]) => form.setValue("begin_message_delay_ms", value)}
                      min={0}
                      max={3000}
                      step={100}
                      className="mt-2"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Wait time before agent speaks to avoid talking over caller's "hello"
                    </p>
                  </div>

                  {/* DTMF Options */}
                  <div className="space-y-4 p-4 bg-muted/20 rounded-lg">
                    <h4 className="font-medium">DTMF (Keypad Input) Settings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="dtmf_digit_limit">Digit Limit</Label>
                        <Input
                          id="dtmf_digit_limit"
                          type="number"
                          value={form.watch("dtmf_digit_limit") || ""}
                          onChange={(e) => form.setValue("dtmf_digit_limit", e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="10"
                          min="1"
                          max="20"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Maximum digits to collect
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="dtmf_termination_key">Termination Key</Label>
                        <Select 
                          value={form.watch("dtmf_termination_key") || ""} 
                          onValueChange={(value) => form.setValue("dtmf_termination_key", value || undefined)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-md">
                            <SelectItem value="">None</SelectItem>
                            <SelectItem value="#"># (Hash)</SelectItem>
                            <SelectItem value="*">* (Star)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground mt-1">
                          Key to end input early
                        </p>
                      </div>

                      <div>
                        <Label>Timeout: {Math.round((form.watch("dtmf_timeout_ms") || 5000) / 1000)}s</Label>
                        <Slider
                          value={[form.watch("dtmf_timeout_ms") || 5000]}
                          onValueChange={([value]) => form.setValue("dtmf_timeout_ms", value)}
                          min={1000}
                          max={30000}
                          step={1000}
                          className="mt-2"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Time to wait for input
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Knowledge Base Settings */}
            <AccordionItem value="knowledge" className="border rounded-lg">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center">
                  <Database className="h-5 w-5 mr-3 text-primary" />
                  <span className="font-semibold">Knowledge Base</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  
                  {/* Current Knowledge Bases */}
                  <div>
                    <h4 className="font-medium mb-3">Attached Knowledge Bases</h4>
                    <div className="space-y-3">
                      {form.watch("kb_ids")?.length > 0 ? (
                        form.watch("kb_ids").map((kbId, index) => (
                          <div key={kbId} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                                <Database className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">Knowledge Base {index + 1}</p>
                                <p className="text-sm text-muted-foreground">ID: {kbId}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Active
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const updatedKbs = form.watch("kb_ids").filter(id => id !== kbId)
                                  form.setValue("kb_ids", updatedKbs)
                                }}
                              >
                                Detach
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>No knowledge bases attached</p>
                          <p className="text-sm">Attach knowledge bases to provide context for your agent</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add Knowledge Base */}
                  <div className="p-4 bg-muted/20 rounded-lg">
                    <h4 className="font-medium mb-3">Attach Knowledge Base</h4>
                    <div className="flex space-x-3">
                      <Input
                        placeholder="Enter Knowledge Base ID"
                        value=""
                        onChange={() => {}}
                      />
                      <Button variant="outline">
                        Attach
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      You can create and manage knowledge bases in the Knowledge section of your dashboard
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Transfers & Tools */}
            <AccordionItem value="transfers-tools" className="border rounded-lg">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center">
                  <Zap className="h-5 w-5 mr-3 text-primary" />
                  <span className="font-semibold">Transfers & Tools</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  
                  {/* Transfer Settings */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Human Transfer</h4>
                    <div>
                      <Label htmlFor="transfer_mode">Transfer Mode</Label>
                      <Select 
                        value={form.watch("transfer_mode") || "disabled"} 
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
                      <p className="text-sm text-muted-foreground mt-1">
                        Warm transfer = agent stays on call. Cold transfer = agent leaves
                      </p>
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

                  {/* Custom Functions/Web Calls */}
                  <div className="space-y-4 p-4 bg-muted/20 rounded-lg">
                    <h4 className="font-medium">Custom Functions & Web Calls</h4>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="webhook_url">Webhook URL</Label>
                        <div className="flex space-x-2">
                          <div className="flex-1">
                            <Input
                              id="webhook_url"
                              {...form.register("webhook_url")}
                              placeholder="https://your-api.com/webhook"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          HTTP endpoint for custom function calls with HMAC signature headers
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>HTTP Method</Label>
                          <Select defaultValue="POST">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-md">
                              <SelectItem value="POST">POST</SelectItem>
                              <SelectItem value="PUT">PUT</SelectItem>
                              <SelectItem value="PATCH">PATCH</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Authentication</Label>
                          <Select defaultValue="hmac">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-md">
                              <SelectItem value="hmac">HMAC Signature</SelectItem>
                              <SelectItem value="bearer">Bearer Token</SelectItem>
                              <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Variables */}
                  <div className="space-y-4 p-4 bg-muted/20 rounded-lg">
                    <h4 className="font-medium">Dynamic Variables</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Use these variables in greetings, voicemail messages, and transfer targets
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <h5 className="font-medium">Call Variables</h5>
                        <div className="space-y-1 font-mono text-xs">
                          <div><code>{"{{caller_number}}"}</code> - Caller's phone number</div>
                          <div><code>{"{{call_id}}"}</code> - Unique call identifier</div>
                          <div><code>{"{{timestamp}}"}</code> - Call start time</div>
                          <div><code>{"{{agent_name}}"}</code> - Agent's name</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h5 className="font-medium">User Variables</h5>
                        <div className="space-y-1 font-mono text-xs">
                          <div><code>{"{{user_name}}"}</code> - Identified user name</div>
                          <div><code>{"{{user_email}}"}</code> - User's email address</div>
                          <div><code>{"{{user_company}}"}</code> - User's company</div>
                          <div><code>{"{{custom_field}}"}</code> - Custom data fields</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <Label htmlFor="variable_examples">Example Usage</Label>
                      <Textarea
                        id="variable_examples"
                        value={`Hello {{user_name}}, this is {{agent_name}} calling from your company.

Voicemail: "Hi {{user_name}}, I called at {{timestamp}} but missed you. Please call back at your convenience."`}
                        readOnly
                        className="min-h-[80px] font-mono text-sm bg-muted/50"
                      />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Privacy & Storage */}
            <AccordionItem value="privacy" className="border rounded-lg">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center">
                  <Lock className="h-5 w-5 mr-3 text-primary" />
                  <span className="font-semibold">Privacy & Storage</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  
                  {/* Data Storage Settings */}
                  <div>
                    <Label htmlFor="data_storage_setting">Data Storage Policy</Label>
                    <Select 
                      value={form.watch("data_storage_setting") || "standard"} 
                      onValueChange={(value) => form.setValue("data_storage_setting", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select storage policy" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-md">
                        <SelectItem value="standard">Standard Storage</SelectItem>
                        <SelectItem value="opt_out">Opt-out Sensitive Data</SelectItem>
                        <SelectItem value="minimal">Minimal Storage</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-1">
                      {form.watch("data_storage_setting") === "opt_out" 
                        ? "Transcripts/recordings sent via webhook only, links expire quickly"
                        : "Standard retention policy applies to all data"
                      }
                    </p>
                  </div>

                  {/* Secure URLs */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Secure URLs</Label>
                        <p className="text-sm text-muted-foreground">Generate 24-hour signed links for recordings and logs</p>
                      </div>
                      <Switch
                        checked={form.watch("secure_urls_enabled")}
                        onCheckedChange={(checked) => form.setValue("secure_urls_enabled", checked)}
                      />
                    </div>
                    {form.watch("secure_urls_enabled") && (
                      <div className="pl-4 border-l-2 border-muted text-sm text-muted-foreground">
                        <p>✓ Recording URLs will expire after 24 hours</p>
                        <p>✓ Enhanced security for sensitive call data</p>
                        <p>✓ Automatic URL regeneration on access</p>
                      </div>
                    )}
                  </div>

                  {/* Retention Settings */}
                  {form.watch("data_storage_setting") !== "opt_out" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label>Transcript Retention: {form.watch("transcript_retention_days") || 90} days</Label>
                        <Slider
                          value={[form.watch("transcript_retention_days") || 90]}
                          onValueChange={([value]) => form.setValue("transcript_retention_days", value)}
                          min={7}
                          max={365}
                          step={7}
                          className="mt-2"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          How long to store call transcripts
                        </p>
                      </div>

                      <div>
                        <Label>Recording Retention: {form.watch("recording_retention_days") || 30} days</Label>
                        <Slider
                          value={[form.watch("recording_retention_days") || 30]}
                          onValueChange={([value]) => form.setValue("recording_retention_days", value)}
                          min={7}
                          max={180}
                          step={7}
                          className="mt-2"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          How long to store call recordings
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Opt-out Information */}
                  {form.watch("data_storage_setting") === "opt_out" && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <h4 className="font-medium text-yellow-800 mb-2">Sensitive Data Opt-out Enabled</h4>
                      <div className="text-sm text-yellow-700 space-y-1">
                        <p>• Call recordings and transcripts are not stored long-term</p>
                        <p>• Data is delivered immediately via webhook upon call completion</p>
                        <p>• Temporary download links expire within 2 hours</p>
                        <p>• You're responsible for capturing and storing data from webhooks</p>
                      </div>
                    </div>
                  )}

                  {/* Legacy Webhook URL */}
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

            {/* Post-Call Analysis */}
            <AccordionItem value="analysis" className="border rounded-lg">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-3 text-primary" />
                  <span className="font-semibold">Post-Call Analysis</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  
                  {/* Enable Analysis */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Post-Call Analysis</Label>
                      <p className="text-sm text-muted-foreground">Automatically analyze calls with AI after completion</p>
                    </div>
                    <Switch
                      checked={form.watch("analysis_enabled")}
                      onCheckedChange={(checked) => form.setValue("analysis_enabled", checked)}
                    />
                  </div>

                  {form.watch("analysis_enabled") && (
                    <div className="space-y-6">
                      
                      {/* Analysis Model */}
                      <div>
                        <Label htmlFor="analysis_model">Analysis Model</Label>
                        <Select 
                          value={form.watch("analysis_model") || "gpt-4o-mini"} 
                          onValueChange={(value) => form.setValue("analysis_model", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select analysis model" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-md">
                            <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fast & Cost-effective)</SelectItem>
                            <SelectItem value="gpt-4o">GPT-4o (Balanced)</SelectItem>
                            <SelectItem value="gpt-5-nano-2025-08-07">GPT-5 Nano (Latest, Fast)</SelectItem>
                            <SelectItem value="gpt-5-mini-2025-08-07">GPT-5 Mini (Latest, Balanced)</SelectItem>
                            <SelectItem value="gpt-5-2025-08-07">GPT-5 (Latest, Most Capable)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground mt-1">
                          Model used for analyzing call transcripts and generating insights
                        </p>
                      </div>

                      {/* Analysis Webhook */}
                      <div>
                        <Label htmlFor="analysis_webhook_url">Analysis Results Webhook</Label>
                        <Input
                          id="analysis_webhook_url"
                          value={form.watch("analysis_webhook_url") || ""}
                          onChange={(e) => form.setValue("analysis_webhook_url", e.target.value)}
                          placeholder="https://your-api.com/analysis-webhook"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Optional: Send analysis results to your analytics system
                        </p>
                      </div>

                      {/* Custom Analysis Fields */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>Custom Analysis Fields</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const currentFields = form.watch("custom_analysis_fields") || []
                              form.setValue("custom_analysis_fields", [
                                ...currentFields,
                                { name: "", type: "text", description: "" }
                              ])
                            }}
                          >
                            Add Field
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {form.watch("custom_analysis_fields")?.map((field, index) => (
                            <div key={index} className="grid grid-cols-12 gap-3 items-end p-3 border rounded-lg">
                              <div className="col-span-3">
                                <Label>Field Name</Label>
                                <Input
                                  value={field.name}
                                  onChange={(e) => {
                                    const fields = [...(form.watch("custom_analysis_fields") || [])]
                                    fields[index] = { ...fields[index], name: e.target.value }
                                    form.setValue("custom_analysis_fields", fields)
                                  }}
                                  placeholder="e.g., sentiment"
                                />
                              </div>

                              <div className="col-span-2">
                                <Label>Type</Label>
                                <Select
                                  value={field.type}
                                  onValueChange={(value: 'boolean' | 'enum' | 'text' | 'json') => {
                                    const fields = [...(form.watch("custom_analysis_fields") || [])]
                                    fields[index] = { ...fields[index], type: value }
                                    form.setValue("custom_analysis_fields", fields)
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background border shadow-md">
                                    <SelectItem value="boolean">Boolean</SelectItem>
                                    <SelectItem value="enum">Enum</SelectItem>
                                    <SelectItem value="text">Text</SelectItem>
                                    <SelectItem value="json">JSON</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {field.type === 'enum' && (
                                <div className="col-span-3">
                                  <Label>Options</Label>
                                  <Input
                                    value={field.options?.join(", ") || ""}
                                    onChange={(e) => {
                                      const fields = [...(form.watch("custom_analysis_fields") || [])]
                                      fields[index] = { 
                                        ...fields[index], 
                                        options: e.target.value.split(",").map(o => o.trim()).filter(o => o)
                                      }
                                      form.setValue("custom_analysis_fields", fields)
                                    }}
                                    placeholder="positive, neutral, negative"
                                  />
                                </div>
                              )}

                              <div className={field.type === 'enum' ? "col-span-3" : "col-span-6"}>
                                <Label>Description</Label>
                                <Input
                                  value={field.description || ""}
                                  onChange={(e) => {
                                    const fields = [...(form.watch("custom_analysis_fields") || [])]
                                    fields[index] = { ...fields[index], description: e.target.value }
                                    form.setValue("custom_analysis_fields", fields)
                                  }}
                                  placeholder="What should this field analyze?"
                                />
                              </div>

                              <div className="col-span-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const fields = form.watch("custom_analysis_fields") || []
                                    form.setValue("custom_analysis_fields", fields.filter((_, i) => i !== index))
                                  }}
                                >
                                  ×
                                </Button>
                              </div>
                            </div>
                          )) || (
                            <div className="text-center py-6 text-muted-foreground">
                              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No custom analysis fields defined</p>
                              <p className="text-sm">Add fields to extract specific insights from calls</p>
                            </div>
                          )}
                        </div>

                        <div className="p-3 bg-muted/20 rounded-lg text-sm">
                          <h5 className="font-medium mb-2">Analysis Field Examples:</h5>
                          <ul className="space-y-1 text-muted-foreground">
                            <li>• <strong>sentiment</strong> (enum): positive, neutral, negative</li>
                            <li>• <strong>lead_quality</strong> (enum): hot, warm, cold</li>
                            <li>• <strong>appointment_scheduled</strong> (boolean): true/false</li>
                            <li>• <strong>pain_points</strong> (text): Identified customer challenges</li>
                            <li>• <strong>contact_info</strong> (json): Structured contact details</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
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