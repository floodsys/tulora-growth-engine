import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Bot, Mic, Play, Save, Settings, Volume2 } from 'lucide-react'
import { useRetellAgents } from '@/hooks/useRetellAgents'
import { useUserOrganization } from '@/hooks/useUserOrganization'
import { useToast } from '@/hooks/use-toast'

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
  })
  const [saving, setSaving] = useState(false)
  const [newPronunciation, setNewPronunciation] = useState({ word: '', pronunciation: '' })

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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basics" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Basics
          </TabsTrigger>
          <TabsTrigger value="voice" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Voice
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