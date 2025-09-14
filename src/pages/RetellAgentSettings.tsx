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
import { ArrowLeft, Save, Undo2, Play, Upload, Volume2, Settings, Shield, Phone, Code } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PrivacySecuritySettings } from "@/components/PrivacySecuritySettings"
import { WidgetEmbedGenerator } from "@/components/WidgetEmbedGenerator"
import { WebCallTester } from "@/components/WebCallTester"
import { supabase } from "@/integrations/supabase/client"

interface RetellAgent {
  id: string
  organization_id: string
  agent_id: string
  name: string
  version: number
  voice_id?: string
  voice_model?: string
  language: string
  backchannel_enabled: boolean
  backchannel_frequency: number
  pronunciation_dict: any
  voice_speed: number
  voice_temperature: number
  volume: number
  normalize_for_speech: boolean
  max_call_duration_ms: number
  end_call_after_silence_ms: number
  begin_message_delay_ms: number
  voicemail_option: string
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
  description?: string
  preview_url?: string
}

const RetellAgentSettings = () => {
  const { agentId } = useParams<{ agentId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [agent, setAgent] = useState<RetellAgent | null>(null)
  const [voices, setVoices] = useState<Voice[]>([])
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
          {/* Action Bar */}
          <div className="mb-6 flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
              >
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
              
              {hasUnsavedChanges && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    form.reset(agent)
                    setHasUnsavedChanges(false)
                  }}
                >
                  <Undo2 className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              )}
            </div>
            
            {hasUnsavedChanges && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                Unsaved Changes
              </Badge>
            )}
          </div>

          <Accordion type="single" collapsible className="space-y-4" defaultValue="basics">
            
            {/* A) Basics */}
            <AccordionItem value="basics" className="border rounded-lg">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center">
                  <Settings className="h-5 w-5 mr-3 text-primary" />
                  <span className="font-semibold">A) Basics</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  {/* Agent Name & Type */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="name">Agent Name</Label>
                      <Input
                        id="name"
                        {...form.register("name")}
                        placeholder="Enter agent name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="agent_type">Agent Type</Label>
                      <Select 
                        value="prompt-based" 
                        onValueChange={() => {}}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select agent type" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-md">
                          <SelectItem value="prompt-based">Prompt-based</SelectItem>
                          <SelectItem value="flow-based" disabled>Flow-based (Coming Soon)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">Currently only Prompt-based agents are supported</p>
                    </div>
                  </div>

                  {/* Language Settings */}
                  <div>
                    <Label htmlFor="language">Language Detection</Label>
                    <Select 
                      value={form.watch("language")} 
                      onValueChange={(value) => form.setValue("language", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select language mode" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-md">
                        <SelectItem value="en">English Only</SelectItem>
                        <SelectItem value="es">Spanish Only</SelectItem>
                        <SelectItem value="fr">French Only</SelectItem>
                        <SelectItem value="de">German Only</SelectItem>
                        <SelectItem value="it">Italian Only</SelectItem>
                        <SelectItem value="pt">Portuguese Only</SelectItem>
                        <SelectItem value="zh">Chinese Only</SelectItem>
                        <SelectItem value="ja">Japanese Only</SelectItem>
                        <SelectItem value="ko">Korean Only</SelectItem>
                        <SelectItem value="multi" disabled>Multi-language Auto-detect (Coming Soon)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Choose the primary language your agent will understand</p>
                  </div>

                  {/* Response Engine Settings */}
                  <div className="space-y-4">
                    <div>
                      <Label>Response Engine</Label>
                      <Select 
                        value="openai-gpt-4" 
                        onValueChange={() => {}}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select LLM model" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-md">
                          <SelectItem value="openai-gpt-4">OpenAI GPT-4</SelectItem>
                          <SelectItem value="openai-gpt-3.5" disabled>OpenAI GPT-3.5</SelectItem>
                          <SelectItem value="anthropic-claude" disabled>Anthropic Claude</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>LLM Temperature: {(0.7).toFixed(1)}</Label>
                      <Slider
                        value={[0.7]}
                        onValueChange={() => {}}
                        min={0.0}
                        max={2.0}
                        step={0.1}
                        className="mt-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Controls creativity vs consistency (0.0 = very consistent, 2.0 = very creative)</p>
                    </div>

                    <div>
                      <Label htmlFor="system_prompt">Global Prompt/Persona</Label>
                      <Textarea
                        id="system_prompt"
                        placeholder="Enter the agent's personality, role, and behavior instructions..."
                        className="min-h-[120px] mt-2"
                        defaultValue="You are a helpful and professional AI assistant. Be concise, friendly, and always try to provide accurate information."
                      />
                      <p className="text-xs text-muted-foreground mt-1">Define your agent's personality, role, and how it should behave in conversations</p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* B) Voice */}
            <AccordionItem value="voice" className="border rounded-lg">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center">
                  <Volume2 className="h-5 w-5 mr-3 text-primary" />
                  <span className="font-semibold">B) Voice</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  {/* Voice Selection with Preview */}
                  <div>
                    <Label>Voice Selection</Label>
                    <div className="space-y-3">
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
                                  <span className="text-muted-foreground ml-2">({voice.gender}, {voice.accent})</span>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Voice Preview Button */}
                      {form.watch("voice_id") && (
                        <div className="flex items-center space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const selectedVoice = voices.find(v => v.voice_id === form.watch("voice_id"))
                              if (selectedVoice?.preview_url) {
                                playVoicePreview(selectedVoice.voice_id, selectedVoice.preview_url)
                              }
                            }}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Preview Voice
                          </Button>
                          <p className="text-xs text-muted-foreground">Listen to a sample of the selected voice</p>
                        </div>
                      )}
                    </div>

                    {/* Voice Model Selection */}
                    <div className="mt-4">
                      <Label>Voice Model</Label>
                      <Select 
                        value={form.watch("voice_model") || "eleven_turbo_v2"} 
                        onValueChange={(value) => form.setValue("voice_model", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select voice model" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-md">
                          <SelectItem value="eleven_turbo_v2">Eleven Turbo v2 (Fast)</SelectItem>
                          <SelectItem value="eleven_multilingual_v2">Eleven Multilingual v2 (Quality)</SelectItem>
                          <SelectItem value="eleven_turbo_v2_5">Eleven Turbo v2.5 (Balanced)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">Choose between speed and quality</p>
                    </div>
                  </div>

                  {/* Voice Tuning */}
                  <div className="space-y-6">
                    <h4 className="font-medium">Voice Tuning</h4>
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
                        <p className="text-xs text-muted-foreground mt-1">How fast the agent speaks</p>
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
                        <p className="text-xs text-muted-foreground mt-1">Voice expressiveness and variation</p>
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
                        <p className="text-xs text-muted-foreground mt-1">Audio output volume level</p>
                      </div>
                    </div>
                  </div>

                  {/* Pronunciation Dictionary */}
                  <div>
                    <Label>Pronunciation Dictionary</Label>
                    <Textarea
                      placeholder="Enter custom pronunciations (IPA/CMU format)&#10;Example:&#10;API: /eɪ piː aɪ/&#10;SQL: /ˈsiːkwəl/"
                      value={JSON.stringify(form.watch("pronunciation_dict") || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value || '{}')
                          form.setValue("pronunciation_dict", parsed)
                        } catch {
                          // Invalid JSON, ignore
                        }
                      }}
                      className="mt-2 font-mono text-sm"
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Define custom pronunciations for technical terms, names, or acronyms. 
                      Available for eligible ElevenLabs English voices with IPA or CMU phoneme notation.
                    </p>
                  </div>

                  {/* Speech Processing Options */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Speech Processing</h4>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Speech Normalization</Label>
                        <p className="text-sm text-muted-foreground">Convert numbers, currency, dates to spoken form (e.g., "$100" → "one hundred dollars")</p>
                      </div>
                      <Switch
                        checked={form.watch("normalize_for_speech")}
                        onCheckedChange={(checked) => form.setValue("normalize_for_speech", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Enable Backchannel</Label>
                        <p className="text-sm text-muted-foreground">Allow "mm-hmm" and "uh-huh" responses during user speech</p>
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
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* C) Interaction */}
            <AccordionItem value="interaction" className="border rounded-lg">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center">
                  <Volume2 className="h-5 w-5 mr-3 text-primary" />
                  <span className="font-semibold">C) Interaction</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  {/* Backchanneling */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Backchanneling</h4>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Enable Backchanneling</Label>
                        <p className="text-sm text-muted-foreground">Allow "mm-hmm" and "uh-huh" responses during user speech</p>
                      </div>
                      <Switch
                        checked={form.watch("backchannel_enabled")}
                        onCheckedChange={(checked) => form.setValue("backchannel_enabled", checked)}
                      />
                    </div>

                    {form.watch("backchannel_enabled") && (
                      <>
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
                          <p className="text-xs text-muted-foreground mt-1">How often the agent provides backchanneling responses</p>
                        </div>

                        <div>
                          <Label>Custom Backchannel Words</Label>
                          <Input
                            placeholder="mm-hmm, uh-huh, I see, right"
                            className="mt-2"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Comma-separated list of custom backchannel responses</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Responsiveness & Interruption */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Responsiveness & Interruption</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label>Response Speed: Normal</Label>
                        <Slider
                          value={[0.5]}
                          onValueChange={() => {}}
                          min={0.0}
                          max={1.0}
                          step={0.1}
                          className="mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Slower responses (0) vs Faster responses (1)</p>
                      </div>

                      <div>
                        <Label>Interruption Sensitivity: Medium</Label>
                        <Slider
                          value={[0.5]}
                          onValueChange={() => {}}
                          min={0.0}
                          max={1.0}
                          step={0.1}
                          className="mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">How easily the agent yields to user interruptions</p>
                      </div>
                    </div>
                  </div>

                  {/* Background Sound */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Background Sound</h4>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Enable Background Sound</Label>
                        <p className="text-sm text-muted-foreground">Add optional ambient background sound during calls</p>
                      </div>
                      <Switch
                        checked={false}
                        onCheckedChange={() => {}}
                      />
                    </div>

                    <div>
                      <Label>Background Sound Type</Label>
                      <Select value="none" onValueChange={() => {}}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select background sound" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-md">
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="office">Office Ambience</SelectItem>
                          <SelectItem value="cafe">Café Ambience</SelectItem>
                          <SelectItem value="nature">Nature Sounds</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Boosted Keywords */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Boosted Keywords</h4>
                    
                    <div>
                      <Label>Keywords to Boost</Label>
                      <Textarea
                        placeholder="Enter brand names, technical terms, or specific words that the speech-to-text should recognize better...&#10;Example:&#10;Retell, API, webhook, authentication"
                        className="mt-2"
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Help STT catch brand names, technical terms, and specific vocabulary</p>
                    </div>
                  </div>

                  {/* Silence Reminders */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Silence Handling</h4>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Reminders on Silence</Label>
                        <p className="text-sm text-muted-foreground">Send gentle follow-ups during user inactivity</p>
                      </div>
                      <Switch
                        checked={false}
                        onCheckedChange={() => {}}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label>Reminder Delay (seconds)</Label>
                        <Input
                          type="number"
                          placeholder="5"
                          className="mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">How long to wait before sending a reminder</p>
                      </div>

                      <div>
                        <Label>Reminder Message</Label>
                        <Input
                          placeholder="Are you still there?"
                          className="mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Custom message for silence reminders</p>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* D) Call Handling */}
            <AccordionItem value="call-handling" className="border rounded-lg">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center">
                  <Phone className="h-5 w-5 mr-3 text-primary" />
                  <span className="font-semibold">D) Call Handling</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  {/* Voicemail Detection & Behavior */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Voicemail Detection & Behavior</h4>
                    
                    <div>
                      <Label>Voicemail Detection</Label>
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
                          <SelectItem value="leave_message">Leave Message</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">How the agent should handle voicemail detection</p>
                    </div>

                    {form.watch("voicemail_option") === "leave_message" && (
                      <>
                        <div>
                          <Label>Voicemail Message Type</Label>
                          <Select value="static" onValueChange={() => {}}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select message type" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-md">
                              <SelectItem value="static">Static Message</SelectItem>
                              <SelectItem value="generated">AI Generated</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Voicemail Message</Label>
                          <Textarea
                            placeholder="Hi, this is [Agent Name]. I was calling to follow up on your inquiry. Please call us back at your convenience."
                            className="mt-2"
                            rows={3}
                          />
                          <p className="text-xs text-muted-foreground mt-1">Message to leave on voicemail (can use variables like [Agent Name])</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Call Timeouts */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Call Timeouts</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label>End Call After Silence (seconds)</Label>
                        <Input
                          type="number"
                          value={Math.round((form.watch("end_call_after_silence_ms") || 10000) / 1000)}
                          onChange={(e) => form.setValue("end_call_after_silence_ms", parseInt(e.target.value) * 1000)}
                          placeholder="10"
                        />
                        <p className="text-xs text-muted-foreground mt-1">How long to wait before ending due to silence</p>
                      </div>

                      <div>
                        <Label>Max Call Duration (minutes)</Label>
                        <Input
                          type="number"
                          value={Math.round((form.watch("max_call_duration_ms") || 1800000) / 60000)}
                          onChange={(e) => form.setValue("max_call_duration_ms", parseInt(e.target.value) * 60000)}
                          placeholder="30"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Maximum duration before automatically ending call</p>
                      </div>
                    </div>
                  </div>

                  {/* Message Timing */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Message Timing</h4>
                    
                    <div>
                      <Label>Pause Before First Message (ms)</Label>
                      <Input
                        type="number"
                        {...form.register("begin_message_delay_ms", { valueAsNumber: true })}
                        placeholder="800"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Delay before the agent speaks to avoid talking over the callee's "hello"</p>
                    </div>
                  </div>

                  {/* DTMF Options */}
                  <div className="space-y-4">
                    <h4 className="font-medium">DTMF (Keypad) Options</h4>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Enable DTMF Input</Label>
                        <p className="text-sm text-muted-foreground">Allow users to provide keypad input during calls</p>
                      </div>
                      <Switch
                        checked={false}
                        onCheckedChange={() => {}}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <Label>Digit Limit</Label>
                        <Input
                          type="number"
                          placeholder="10"
                          min="1"
                          max="20"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Maximum number of digits to collect</p>
                      </div>

                      <div>
                        <Label>Termination Key</Label>
                        <Select value="#" onValueChange={() => {}}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select key" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-md">
                            <SelectItem value="#"># (Hash)</SelectItem>
                            <SelectItem value="*">* (Star)</SelectItem>
                            <SelectItem value="none">None</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">Key to end DTMF input</p>
                      </div>

                      <div>
                        <Label>Timeout (seconds)</Label>
                        <Input
                          type="number"
                          placeholder="5"
                          min="1"
                          max="30"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Time to wait for input before timeout</p>
                      </div>
                    </div>
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
              <AccordionTrigger className="p-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold">Privacy & Security</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-0">
                <PrivacySecuritySettings 
                  agent={agent}
                  onUpdate={(updates) => {
                    Object.entries(updates).forEach(([key, value]) => {
                      form.setValue(key as any, value)
                    })
                  }}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Widget & Embed */}
            <AccordionItem value="widget" className="border rounded-lg">
              <AccordionTrigger className="p-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Code className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold">Website Widget</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-0">
                <WidgetEmbedGenerator 
                  agent={agent}
                  organizationId={organizationId}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Test & Preview */}
            <AccordionItem value="testing" className="border rounded-lg">
              <AccordionTrigger className="p-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Play className="w-5 h-5 text-green-600" />
                  <span className="font-semibold">Test & Preview</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-0">
                <div className="space-y-4">
                  {agent.status === 'published' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <WebCallTester agent={agent} className="w-full" />
                      <Button variant="outline" disabled>
                        <Phone className="h-4 w-4 mr-2" />
                        Phone Test (Coming Soon)
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        Publish this agent to enable testing features
                      </p>
                      <Button onClick={handlePublish} disabled={publishing}>
                        {publishing ? "Publishing..." : "Publish Agent"}
                      </Button>
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