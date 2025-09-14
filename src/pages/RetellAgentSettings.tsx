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
import { ArrowLeft, Save, Undo2, Play, Upload, Volume2, Settings, Shield, Phone } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
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
                    <Label htmlFor="language">Language</Label>
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
                      </SelectContent>
                    </Select>
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
                                <span className="text-muted-foreground ml-2">({voice.gender}, {voice.accent})</span>
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
                        <p className="text-sm text-muted-foreground">Optimize audio for spoken content</p>
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