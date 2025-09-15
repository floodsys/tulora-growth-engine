import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { Shield, AlertTriangle, Phone, MessageSquare, Bot } from "lucide-react"

interface AbusePreventionConfig {
  rate_limiting: {
    enabled: boolean
    calls_per_minute: number
    calls_per_hour: number
    calls_per_day: number
    block_duration_minutes: number
  }
  recaptcha: {
    enabled: boolean
    site_key: string
    threshold: number
  }
  call_patterns: {
    enabled: boolean
    max_duration_minutes: number
    max_consecutive_calls: number
    cooldown_period_minutes: number
    detect_robocalls: boolean
  }
  geographic_blocking: {
    enabled: boolean
    blocked_countries: string[]
    blocked_regions: string[]
  }
  content_filtering: {
    enabled: boolean
    block_profanity: boolean
    detect_spam_patterns: boolean
    custom_blocked_phrases: string[]
  }
}

export function AbusePreventionSettings() {
  const [config, setConfig] = useState<AbusePreventionConfig>({
    rate_limiting: {
      enabled: true,
      calls_per_minute: 10,
      calls_per_hour: 60,
      calls_per_day: 500,
      block_duration_minutes: 15
    },
    recaptcha: {
      enabled: false,
      site_key: "",
      threshold: 0.5
    },
    call_patterns: {
      enabled: true,
      max_duration_minutes: 30,
      max_consecutive_calls: 5,
      cooldown_period_minutes: 5,
      detect_robocalls: true
    },
    geographic_blocking: {
      enabled: false,
      blocked_countries: [],
      blocked_regions: []
    },
    content_filtering: {
      enabled: true,
      block_profanity: true,
      detect_spam_patterns: true,
      custom_blocked_phrases: []
    }
  })
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      // Load from organization settings or use defaults
      const { data: org } = await supabase
        .from('organizations')
        .select('analytics_config')
        .single()

      if (org?.analytics_config && typeof org.analytics_config === 'object' && 'abuse_prevention' in org.analytics_config) {
        setConfig(org.analytics_config.abuse_prevention as unknown as AbusePreventionConfig)
      }
    } catch (error) {
      console.error('Failed to load config:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          analytics_config: { abuse_prevention: config } as any
        })
        .eq('id', 'current-org-id') // This should be dynamic

      if (error) throw error
      
      toast.success("Abuse prevention settings saved")
    } catch (error) {
      toast.error("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (section: keyof AbusePreventionConfig, updates: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates }
    }))
  }

  if (loading) {
    return <div className="text-center py-8">Loading settings...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Abuse Prevention</h2>
          <p className="text-muted-foreground">
            Configure protection against spam, abuse, and malicious usage
          </p>
        </div>
        <Button onClick={saveConfig} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <Tabs defaultValue="rate-limiting" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="rate-limiting">Rate Limiting</TabsTrigger>
          <TabsTrigger value="recaptcha">reCAPTCHA</TabsTrigger>
          <TabsTrigger value="call-patterns">Call Patterns</TabsTrigger>
          <TabsTrigger value="geographic">Geographic</TabsTrigger>
          <TabsTrigger value="content">Content Filter</TabsTrigger>
        </TabsList>

        <TabsContent value="rate-limiting" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Rate Limiting
                  </CardTitle>
                  <CardDescription>
                    Limit the number of calls per user to prevent abuse
                  </CardDescription>
                </div>
                <Switch
                  checked={config.rate_limiting.enabled}
                  onCheckedChange={(enabled) => updateConfig('rate_limiting', { enabled })}
                />
              </div>
            </CardHeader>
            
            {config.rate_limiting.enabled && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Calls per minute</Label>
                    <Input
                      type="number"
                      value={config.rate_limiting.calls_per_minute}
                      onChange={(e) => updateConfig('rate_limiting', { 
                        calls_per_minute: parseInt(e.target.value) 
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Calls per hour</Label>
                    <Input
                      type="number"
                      value={config.rate_limiting.calls_per_hour}
                      onChange={(e) => updateConfig('rate_limiting', { 
                        calls_per_hour: parseInt(e.target.value) 
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Calls per day</Label>
                    <Input
                      type="number"
                      value={config.rate_limiting.calls_per_day}
                      onChange={(e) => updateConfig('rate_limiting', { 
                        calls_per_day: parseInt(e.target.value) 
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Block duration (minutes)</Label>
                    <Input
                      type="number"
                      value={config.rate_limiting.block_duration_minutes}
                      onChange={(e) => updateConfig('rate_limiting', { 
                        block_duration_minutes: parseInt(e.target.value) 
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="recaptcha" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    reCAPTCHA Protection
                  </CardTitle>
                  <CardDescription>
                    Use Google reCAPTCHA to verify human users
                  </CardDescription>
                </div>
                <Switch
                  checked={config.recaptcha.enabled}
                  onCheckedChange={(enabled) => updateConfig('recaptcha', { enabled })}
                />
              </div>
            </CardHeader>
            
            {config.recaptcha.enabled && (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>reCAPTCHA Site Key</Label>
                  <Input
                    placeholder="Your reCAPTCHA v3 site key"
                    value={config.recaptcha.site_key}
                    onChange={(e) => updateConfig('recaptcha', { site_key: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Get your site key from the <a href="https://www.google.com/recaptcha" target="_blank" className="underline">Google reCAPTCHA console</a>
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Score Threshold (0.0 - 1.0)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.recaptcha.threshold}
                    onChange={(e) => updateConfig('recaptcha', { 
                      threshold: parseFloat(e.target.value) 
                    })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Lower values are more restrictive. Recommended: 0.5
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="call-patterns" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Call Pattern Detection
                  </CardTitle>
                  <CardDescription>
                    Detect and prevent suspicious calling patterns
                  </CardDescription>
                </div>
                <Switch
                  checked={config.call_patterns.enabled}
                  onCheckedChange={(enabled) => updateConfig('call_patterns', { enabled })}
                />
              </div>
            </CardHeader>
            
            {config.call_patterns.enabled && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max call duration (minutes)</Label>
                    <Input
                      type="number"
                      value={config.call_patterns.max_duration_minutes}
                      onChange={(e) => updateConfig('call_patterns', { 
                        max_duration_minutes: parseInt(e.target.value) 
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max consecutive calls</Label>
                    <Input
                      type="number"
                      value={config.call_patterns.max_consecutive_calls}
                      onChange={(e) => updateConfig('call_patterns', { 
                        max_consecutive_calls: parseInt(e.target.value) 
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cooldown period (minutes)</Label>
                    <Input
                      type="number"
                      value={config.call_patterns.cooldown_period_minutes}
                      onChange={(e) => updateConfig('call_patterns', { 
                        cooldown_period_minutes: parseInt(e.target.value) 
                      })}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={config.call_patterns.detect_robocalls}
                    onCheckedChange={(detect_robocalls) => 
                      updateConfig('call_patterns', { detect_robocalls })
                    }
                  />
                  <Label>Detect automated/robocalls</Label>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="geographic" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Geographic Blocking
                  </CardTitle>
                  <CardDescription>
                    Block calls from specific countries or regions
                  </CardDescription>
                </div>
                <Switch
                  checked={config.geographic_blocking.enabled}
                  onCheckedChange={(enabled) => updateConfig('geographic_blocking', { enabled })}
                />
              </div>
            </CardHeader>
            
            {config.geographic_blocking.enabled && (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Blocked Countries</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select countries to block" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CN">China</SelectItem>
                      <SelectItem value="RU">Russia</SelectItem>
                      <SelectItem value="KP">North Korea</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {config.geographic_blocking.blocked_countries.map(country => (
                      <Badge key={country} variant="secondary">
                        {country}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Content Filtering
                  </CardTitle>
                  <CardDescription>
                    Filter inappropriate content and spam
                  </CardDescription>
                </div>
                <Switch
                  checked={config.content_filtering.enabled}
                  onCheckedChange={(enabled) => updateConfig('content_filtering', { enabled })}
                />
              </div>
            </CardHeader>
            
            {config.content_filtering.enabled && (
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.content_filtering.block_profanity}
                      onCheckedChange={(block_profanity) => 
                        updateConfig('content_filtering', { block_profanity })
                      }
                    />
                    <Label>Block profanity and offensive language</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config.content_filtering.detect_spam_patterns}
                      onCheckedChange={(detect_spam_patterns) => 
                        updateConfig('content_filtering', { detect_spam_patterns })
                      }
                    />
                    <Label>Detect spam patterns</Label>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Custom Blocked Phrases</Label>
                  <Input
                    placeholder="Enter comma-separated phrases to block"
                    value={config.content_filtering.custom_blocked_phrases.join(', ')}
                    onChange={(e) => updateConfig('content_filtering', { 
                      custom_blocked_phrases: e.target.value.split(',').map(p => p.trim()).filter(p => p)
                    })}
                  />
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}