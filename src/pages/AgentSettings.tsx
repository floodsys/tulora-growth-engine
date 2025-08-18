import { useState, useEffect } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
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
import { ArrowLeft, Save, Undo2, Phone, Copy, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface AgentProfile {
  id: string
  organization_id: string
  name: string
  retell_agent_id: string
  status: 'active' | 'disabled'
  is_default: boolean
  first_message_mode: 'assistant_speaks' | 'assistant_waits' | 'model_generated'
  first_message?: string
  system_prompt?: string
  voice?: string
  language: string
  temperature?: number
  max_tokens?: number
  call_recording_enabled: boolean
  warm_transfer_enabled: boolean
  transfer_number?: string
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

const categories = [
  { id: 'general', label: 'General' },
  { id: 'first-message', label: 'First Message' },
  { id: 'ai-configuration', label: 'AI Configuration' },
  { id: 'call-features', label: 'Call Features' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'advanced', label: 'Advanced' },
]

const AgentSettings = () => {
  const { agentId } = useParams<{ agentId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  
  const [agent, setAgent] = useState<AgentProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [testCallOpen, setTestCallOpen] = useState(false)
  const [testPhoneNumber, setTestPhoneNumber] = useState("")
  const [activeCategory, setActiveCategory] = useState('general')
  const [accordionValue, setAccordionValue] = useState<string[]>(['general'])
  const [copiedRetellId, setCopiedRetellId] = useState(false)

  const form = useForm<AgentProfile>()
  const { watch, reset, getValues, formState: { isDirty } } = form

  // Watch for changes
  useEffect(() => {
    const subscription = watch(() => {
      setHasUnsavedChanges(isDirty)
    })
    return () => subscription.unsubscribe()
  }, [watch, isDirty])

  // Load agent data
  useEffect(() => {
    const loadAgent = async () => {
      if (!agentId) return

      console.log('Loading agent with ID:', agentId)
      console.log('Current URL:', window.location.href)

      try {
        const { data, error } = await supabase.functions.invoke('agents', {
          body: { method: 'GET', agentId }
        })

        console.log('Supabase response:', { data, error })

        if (error) {
          console.error('Supabase function error:', error)
          throw error
        }

        const agentData = data as AgentProfile
        console.log('Loaded agent data:', agentData)
        setAgent(agentData)
        reset(agentData)
      } catch (error) {
        console.error('Error loading agent:', error)
        toast({
          title: "Error",
          description: "Failed to load agent settings.",
          variant: "destructive"
        })
        navigate("/dashboard")
      } finally {
        setIsLoading(false)
      }
    }

    loadAgent()
  }, [agentId, navigate, toast, reset])

  // Scroll to hash on load
  useEffect(() => {
    if (location.hash) {
      const element = document.querySelector(location.hash)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
        const categoryId = location.hash.substring(1)
        setActiveCategory(categoryId)
        if (!accordionValue.includes(categoryId)) {
          setAccordionValue(prev => [...prev, categoryId])
        }
      }
    }
  }, [location.hash, accordionValue])

  // Unsaved changes guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const scrollToCategory = (categoryId: string) => {
    const element = document.getElementById(categoryId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
      setActiveCategory(categoryId)
      if (!accordionValue.includes(categoryId)) {
        setAccordionValue(prev => [...prev, categoryId])
      }
    }
  }

  const handleSave = async () => {
    if (!agent) return

    setIsSaving(true)
    try {
      const formData = getValues()
      
      // Only send changed fields
      const changes: Partial<AgentProfile> = {}
      Object.keys(formData).forEach(key => {
        const typedKey = key as keyof AgentProfile
        if (formData[typedKey] !== agent[typedKey]) {
          ;(changes as any)[typedKey] = formData[typedKey]
        }
      })

      if (Object.keys(changes).length === 0) {
        toast({
          title: "No Changes",
          description: "No changes to save.",
        })
        return
      }

      // Optimistic update
      const updatedAgent = { ...agent, ...changes }
      setAgent(updatedAgent)

      const { data, error } = await supabase.functions.invoke('agents', {
        body: { method: 'PATCH', agentId: agent.id, ...changes }
      })

      if (error) throw error

      setAgent(data as AgentProfile)
      reset(data)
      setHasUnsavedChanges(false)

      toast({
        title: "Settings Saved",
        description: "Agent settings have been updated successfully.",
      })
    } catch (error) {
      console.error('Error saving agent:', error)
      // Revert optimistic update
      if (agent) {
        setAgent(agent)
        reset(agent)
      }
      toast({
        title: "Error",
        description: "Failed to save agent settings. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRevert = () => {
    if (agent) {
      reset(agent)
      setHasUnsavedChanges(false)
      toast({
        title: "Changes Reverted",
        description: "All unsaved changes have been discarded.",
      })
    }
  }

  const handleTestCall = async () => {
    if (!agent || !testPhoneNumber) {
      toast({
        title: "Error",
        description: "Please enter a phone number",
        variant: "destructive"
      })
      return
    }

    // Validate phone number
    if (!/^\+\d{7,15}$/.test(testPhoneNumber)) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid phone number in E.164 format (+1234567890)",
        variant: "destructive"
      })
      return
    }

    try {
      const { data, error } = await supabase.functions.invoke('retell-dial', {
        body: {
          agentId: agent.retell_agent_id,
          phoneNumber: testPhoneNumber,
          agentProfileId: agent.id
        }
      })

      if (error) throw error

      toast({
        title: "Test Call Initiated",
        description: `Calling ${testPhoneNumber} with ${agent.name}`,
      })
      
      setTestCallOpen(false)
      setTestPhoneNumber("")
    } catch (error) {
      console.error('Error initiating test call:', error)
      toast({
        title: "Error",
        description: "Failed to initiate test call",
        variant: "destructive"
      })
    }
  }

  const copyRetellId = async () => {
    if (agent?.retell_agent_id) {
      await navigator.clipboard.writeText(agent.retell_agent_id)
      setCopiedRetellId(true)
      setTimeout(() => setCopiedRetellId(false), 2000)
      toast({
        title: "Copied",
        description: "Retell Agent ID copied to clipboard",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading agent settings...</p>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-muted-foreground">Agent not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="container max-w-6xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => {
                if (hasUnsavedChanges) {
                  const shouldLeave = confirm("You have unsaved changes. Are you sure you want to leave?")
                  if (!shouldLeave) return
                }
                navigate("/dashboard")
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              <p className="text-muted-foreground">Agent Settings</p>
            </div>
            
            <Dialog open={testCallOpen} onOpenChange={setTestCallOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Phone className="h-4 w-4 mr-2" />
                  Test Call
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Test Call</DialogTitle>
                  <DialogDescription>
                    Place a test call using {agent.name}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="test-phone">Phone Number</Label>
                    <Input
                      id="test-phone"
                      placeholder="+1 (555) 123-4567"
                      value={testPhoneNumber}
                      onChange={(e) => setTestPhoneNumber(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter phone number in E.164 format (+1234567890)
                    </p>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setTestCallOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleTestCall}>
                      <Phone className="h-4 w-4 mr-2" />
                      Start Call
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Category Navigation */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={activeCategory === category.id ? "default" : "ghost"}
                size="sm"
                onClick={() => scrollToCategory(category.id)}
                className="whitespace-nowrap"
              >
                {category.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-4xl mx-auto p-6 pb-32">
        <form className="space-y-6">
          <Accordion 
            type="multiple" 
            value={accordionValue} 
            onValueChange={setAccordionValue}
            className="space-y-4"
          >
            {/* General */}
            <AccordionItem value="general" id="general">
              <AccordionTrigger className="text-lg font-semibold">
                General
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Agent Name</Label>
                    <Input
                      id="name"
                      {...form.register("name")}
                      defaultValue={agent.name}
                    />
                  </div>
                  <div>
                    <Label htmlFor="retell-id">Retell Agent ID</Label>
                    <div className="flex gap-2">
                      <Input
                        id="retell-id"
                        value={agent.retell_agent_id}
                        disabled
                        className="bg-muted flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={copyRetellId}
                      >
                        {copiedRetellId ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Agent ID cannot be changed
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select 
                      defaultValue={agent.status}
                      onValueChange={(value: 'active' | 'disabled') => 
                        form.setValue('status', value, { shouldDirty: true })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2 pt-6">
                    <Checkbox
                      id="is-default"
                      defaultChecked={agent.is_default}
                      onCheckedChange={(checked) => 
                        form.setValue('is_default', !!checked, { shouldDirty: true })
                      }
                    />
                    <Label htmlFor="is-default">Set as default agent</Label>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* First Message */}
            <AccordionItem value="first-message" id="first-message">
              <AccordionTrigger className="text-lg font-semibold">
                First Message
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div>
                  <Label>First Message Mode</Label>
                  <RadioGroup
                    defaultValue={agent.first_message_mode}
                    onValueChange={(value: 'assistant_speaks' | 'assistant_waits' | 'model_generated') =>
                      form.setValue('first_message_mode', value, { shouldDirty: true })
                    }
                    className="mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="assistant_speaks" id="assistant_speaks" />
                      <Label htmlFor="assistant_speaks">Assistant speaks first</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="assistant_waits" id="assistant_waits" />
                      <Label htmlFor="assistant_waits">Assistant waits for user</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="model_generated" id="model_generated" />
                      <Label htmlFor="model_generated">Model generated</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="first-message">First Message</Label>
                  <Textarea
                    id="first-message"
                    {...form.register("first_message")}
                    defaultValue={agent.first_message || ""}
                    rows={3}
                    placeholder={
                      form.watch('first_message_mode') === 'model_generated'
                        ? "The AI will generate an appropriate first message based on context"
                        : "Enter the first message the agent will speak"
                    }
                    disabled={form.watch('first_message_mode') === 'model_generated'}
                  />
                  {form.watch('first_message_mode') === 'model_generated' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      The AI will automatically generate context-appropriate opening messages
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="system-prompt">System Prompt</Label>
                  <Textarea
                    id="system-prompt"
                    {...form.register("system_prompt")}
                    defaultValue={agent.system_prompt || ""}
                    rows={6}
                    placeholder="Enter the system prompt that defines the agent's behavior, personality, and instructions..."
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* AI Configuration */}
            <AccordionItem value="ai-configuration" id="ai-configuration">
              <AccordionTrigger className="text-lg font-semibold">
                AI Configuration
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="voice">Voice</Label>
                    <Select 
                      defaultValue={agent.voice || "alloy"}
                      onValueChange={(value) => 
                        form.setValue('voice', value, { shouldDirty: true })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alloy">Alloy</SelectItem>
                        <SelectItem value="echo">Echo</SelectItem>
                        <SelectItem value="fable">Fable</SelectItem>
                        <SelectItem value="onyx">Onyx</SelectItem>
                        <SelectItem value="nova">Nova</SelectItem>
                        <SelectItem value="shimmer">Shimmer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="language">Language</Label>
                    <Select 
                      defaultValue={agent.language}
                      onValueChange={(value) => 
                        form.setValue('language', value, { shouldDirty: true })
                      }
                    >
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
                        <SelectItem value="zh">Chinese</SelectItem>
                        <SelectItem value="ja">Japanese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="temperature">Temperature</Label>
                    <Input
                      id="temperature"
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      {...form.register("temperature", { 
                        valueAsNumber: true,
                        min: 0,
                        max: 1
                      })}
                      defaultValue={agent.temperature || 0.7}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Controls randomness (0-1). Higher values make output more creative.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="max-tokens">Max Tokens</Label>
                    <Input
                      id="max-tokens"
                      type="number"
                      min="50"
                      max="2000"
                      {...form.register("max_tokens", { 
                        valueAsNumber: true,
                        min: 50,
                        max: 2000
                      })}
                      defaultValue={agent.max_tokens || 1000}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Maximum response length (50-2000 tokens)
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Call Features */}
            <AccordionItem value="call-features" id="call-features">
              <AccordionTrigger className="text-lg font-semibold">
                Call Features
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Call Recording</Label>
                    <p className="text-sm text-muted-foreground">
                      Record all calls for quality assurance and training purposes
                    </p>
                  </div>
                  <Switch
                    defaultChecked={agent.call_recording_enabled}
                    onCheckedChange={(checked) => 
                      form.setValue('call_recording_enabled', checked, { shouldDirty: true })
                    }
                  />
                </div>
                <div className="bg-muted/50 p-3 rounded-md">
                  <p className="text-sm text-muted-foreground">
                    <strong>Usage Note:</strong> Call recordings are stored securely and can be accessed 
                    through the Calls section in your dashboard. Recordings are automatically deleted 
                    after 90 days unless configured otherwise.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Transfers */}
            <AccordionItem value="transfers" id="transfers">
              <AccordionTrigger className="text-lg font-semibold">
                Transfers
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Warm Transfer</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow the agent to transfer calls to a human representative
                    </p>
                  </div>
                  <Switch
                    defaultChecked={agent.warm_transfer_enabled}
                    onCheckedChange={(checked) => 
                      form.setValue('warm_transfer_enabled', checked, { shouldDirty: true })
                    }
                  />
                </div>

                {form.watch('warm_transfer_enabled') && (
                  <div>
                    <Label htmlFor="transfer-number">Transfer Number</Label>
                    <Input
                      id="transfer-number"
                      {...form.register("transfer_number", {
                        pattern: {
                          value: /^\+\d{7,15}$/,
                          message: "Please enter a valid E.164 format number"
                        }
                      })}
                      defaultValue={agent.transfer_number || ""}
                      placeholder="+1 (555) 123-4567"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Phone number to transfer calls to (E.164 format: +1234567890)
                    </p>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Advanced */}
            <AccordionItem value="advanced" id="advanced">
              <AccordionTrigger className="text-lg font-semibold">
                Advanced
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="settings-json">Raw Settings (JSON)</Label>
                  <Textarea
                    id="settings-json"
                    {...form.register("settings")}
                    defaultValue={JSON.stringify(agent.settings, null, 2)}
                    rows={8}
                    className="font-mono text-sm"
                    placeholder="{}"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Advanced configuration in JSON format. Use with caution - invalid JSON will be rejected.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </form>
      </div>

      {/* Sticky Save Button Group */}
      <div className="fixed bottom-6 right-6 flex gap-2 z-50">
        {hasUnsavedChanges && (
          <Button variant="outline" onClick={handleRevert}>
            <Undo2 className="h-4 w-4 mr-2" />
            Revert
          </Button>
        )}
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !hasUnsavedChanges}
          className="shadow-lg"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}

export default AgentSettings