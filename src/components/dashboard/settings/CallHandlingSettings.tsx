import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Clock, VolumeX, MessageSquare, Settings } from "lucide-react";

interface CallHandlingSettingsProps {
  organizationId?: string;
}

interface CallHandlingConfig {
  // Call Routing
  routing_strategy: 'round_robin' | 'priority' | 'longest_idle' | 'random';
  max_queue_time: number;
  queue_music_enabled: boolean;
  queue_message: string;
  
  // Call Recording
  recording_enabled: boolean;
  recording_retention_days: number;
  recording_consent_required: boolean;
  
  // Voicemail
  voicemail_enabled: boolean;
  voicemail_greeting: string;
  voicemail_transcription: boolean;
  
  // Call Timeouts
  ring_timeout: number;
  max_call_duration: number;
  
  // Advanced Features
  call_whisper_enabled: boolean;
  call_monitoring_enabled: boolean;
  call_barging_enabled: boolean;
  
  // Business Hours
  business_hours_enabled: boolean;
  business_hours: {
    [key: string]: { start: string; end: string; enabled: boolean };
  };
  after_hours_message: string;
}

const defaultConfig: CallHandlingConfig = {
  routing_strategy: 'round_robin',
  max_queue_time: 300,
  queue_music_enabled: true,
  queue_message: "Thank you for calling. You are currently in queue. Please hold while we connect you to the next available agent.",
  
  recording_enabled: true,
  recording_retention_days: 30,
  recording_consent_required: true,
  
  voicemail_enabled: true,
  voicemail_greeting: "Thank you for calling. Please leave a detailed message and we'll get back to you as soon as possible.",
  voicemail_transcription: true,
  
  ring_timeout: 30,
  max_call_duration: 3600,
  
  call_whisper_enabled: false,
  call_monitoring_enabled: false,
  call_barging_enabled: false,
  
  business_hours_enabled: false,
  business_hours: {
    monday: { start: '09:00', end: '17:00', enabled: true },
    tuesday: { start: '09:00', end: '17:00', enabled: true },
    wednesday: { start: '09:00', end: '17:00', enabled: true },
    thursday: { start: '09:00', end: '17:00', enabled: true },
    friday: { start: '09:00', end: '17:00', enabled: true },
    saturday: { start: '09:00', end: '13:00', enabled: false },
    sunday: { start: '09:00', end: '13:00', enabled: false }
  },
  after_hours_message: "Thank you for calling. We are currently closed. Please leave a voicemail or call back during business hours."
};

export function CallHandlingSettings({ organizationId }: CallHandlingSettingsProps) {
  const [config, setConfig] = useState<CallHandlingConfig>(defaultConfig);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (organizationId) {
      loadCallHandlingSettings();
    }
  }, [organizationId]);

  const loadCallHandlingSettings = async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('webhook_config')
        .eq('id', organizationId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.webhook_config && typeof data.webhook_config === 'object' && 'call_handling' in data.webhook_config) {
        setConfig({ ...defaultConfig, ...(data.webhook_config as any).call_handling });
      }
    } catch (error) {
      console.error('Error loading call handling settings:', error);
      toast({
        title: "Error",
        description: "Failed to load call handling settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveCallHandlingSettings = async () => {
    if (!organizationId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          webhook_config: { call_handling: config } as any
        })
        .eq('id', organizationId);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Call handling settings have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving call handling settings:', error);
      toast({
        title: "Error",
        description: "Failed to save call handling settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (updates: Partial<CallHandlingConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const updateBusinessHours = (day: string, updates: Partial<{ start: string; end: string; enabled: boolean }>) => {
    setConfig(prev => ({
      ...prev,
      business_hours: {
        ...prev.business_hours,
        [day]: { ...prev.business_hours[day], ...updates }
      }
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call Handling
          </CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Call Routing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call Routing
          </CardTitle>
          <CardDescription>
            Configure how incoming calls are distributed to agents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Routing Strategy</Label>
              <Select
                value={config.routing_strategy}
                onValueChange={(value) => updateConfig({ routing_strategy: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                  <SelectItem value="priority">Priority Based</SelectItem>
                  <SelectItem value="longest_idle">Longest Idle</SelectItem>
                  <SelectItem value="random">Random</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Max Queue Time (seconds)</Label>
              <Input
                type="number"
                value={config.max_queue_time}
                onChange={(e) => updateConfig({ max_queue_time: parseInt(e.target.value) })}
                min="30"
                max="1800"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Queue Music</Label>
                <p className="text-sm text-muted-foreground">Play music while customers wait</p>
              </div>
              <Switch
                checked={config.queue_music_enabled}
                onCheckedChange={(queue_music_enabled) => updateConfig({ queue_music_enabled })}
              />
            </div>

            <div className="space-y-2">
              <Label>Queue Message</Label>
              <Textarea
                value={config.queue_message}
                onChange={(e) => updateConfig({ queue_message: e.target.value })}
                placeholder="Message played to customers in queue"
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call Recording */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <VolumeX className="h-5 w-5" />
            Call Recording
          </CardTitle>
          <CardDescription>
            Configure call recording and retention policies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Call Recording</Label>
              <p className="text-sm text-muted-foreground">Record all calls for quality and training purposes</p>
            </div>
            <Switch
              checked={config.recording_enabled}
              onCheckedChange={(recording_enabled) => updateConfig({ recording_enabled })}
            />
          </div>

          {config.recording_enabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Retention Period (days)</Label>
                  <Input
                    type="number"
                    value={config.recording_retention_days}
                    onChange={(e) => updateConfig({ recording_retention_days: parseInt(e.target.value) })}
                    min="1"
                    max="365"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Consent Required</Label>
                    <p className="text-sm text-muted-foreground">Announce recording to callers</p>
                  </div>
                  <Switch
                    checked={config.recording_consent_required}
                    onCheckedChange={(recording_consent_required) => updateConfig({ recording_consent_required })}
                  />
                </div>
              </div>

              <Alert>
                <AlertDescription>
                  Recording laws vary by jurisdiction. Ensure compliance with local regulations.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Voicemail */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Voicemail
          </CardTitle>
          <CardDescription>
            Configure voicemail settings and greetings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Voicemail</Label>
              <p className="text-sm text-muted-foreground">Allow callers to leave voicemail messages</p>
            </div>
            <Switch
              checked={config.voicemail_enabled}
              onCheckedChange={(voicemail_enabled) => updateConfig({ voicemail_enabled })}
            />
          </div>

          {config.voicemail_enabled && (
            <>
              <div className="space-y-2">
                <Label>Voicemail Greeting</Label>
                <Textarea
                  value={config.voicemail_greeting}
                  onChange={(e) => updateConfig({ voicemail_greeting: e.target.value })}
                  placeholder="Message played before voicemail recording"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Voicemail Transcription</Label>
                  <p className="text-sm text-muted-foreground">Automatically transcribe voicemail messages</p>
                </div>
                <Switch
                  checked={config.voicemail_transcription}
                  onCheckedChange={(voicemail_transcription) => updateConfig({ voicemail_transcription })}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Call Timeouts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Call Timeouts
          </CardTitle>
          <CardDescription>
            Configure call timing and duration limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Label>Ring Timeout: {config.ring_timeout} seconds</Label>
              <Slider
                value={[config.ring_timeout]}
                onValueChange={(value) => updateConfig({ ring_timeout: value[0] })}
                min={10}
                max={120}
                step={5}
                className="w-full"
              />
            </div>

            <div className="space-y-4">
              <Label>Max Call Duration: {Math.floor(config.max_call_duration / 60)} minutes</Label>
              <Slider
                value={[config.max_call_duration]}
                onValueChange={(value) => updateConfig({ max_call_duration: value[0] })}
                min={300}
                max={7200}
                step={300}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Advanced Features
          </CardTitle>
          <CardDescription>
            Configure advanced call monitoring and management features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Call Whisper</Label>
                <p className="text-sm text-muted-foreground">Supervisors can whisper to agents during calls</p>
              </div>
              <Switch
                checked={config.call_whisper_enabled}
                onCheckedChange={(call_whisper_enabled) => updateConfig({ call_whisper_enabled })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Call Monitoring</Label>
                <p className="text-sm text-muted-foreground">Supervisors can monitor live calls</p>
              </div>
              <Switch
                checked={config.call_monitoring_enabled}
                onCheckedChange={(call_monitoring_enabled) => updateConfig({ call_monitoring_enabled })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Call Barging</Label>
                <p className="text-sm text-muted-foreground">Supervisors can join calls as participants</p>
              </div>
              <Switch
                checked={config.call_barging_enabled}
                onCheckedChange={(call_barging_enabled) => updateConfig({ call_barging_enabled })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Business Hours</CardTitle>
          <CardDescription>
            Configure when your business is available to receive calls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Business Hours</Label>
              <p className="text-sm text-muted-foreground">Route calls differently outside business hours</p>
            </div>
            <Switch
              checked={config.business_hours_enabled}
              onCheckedChange={(business_hours_enabled) => updateConfig({ business_hours_enabled })}
            />
          </div>

          {config.business_hours_enabled && (
            <>
              <div className="space-y-4">
                {Object.entries(config.business_hours).map(([day, hours]) => (
                  <div key={day} className="flex items-center gap-4">
                    <div className="w-20">
                      <Switch
                        checked={hours.enabled}
                        onCheckedChange={(enabled) => updateBusinessHours(day, { enabled })}
                      />
                    </div>
                    <div className="w-24 text-sm font-medium capitalize">{day}</div>
                    <Input
                      type="time"
                      value={hours.start}
                      onChange={(e) => updateBusinessHours(day, { start: e.target.value })}
                      disabled={!hours.enabled}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={hours.end}
                      onChange={(e) => updateBusinessHours(day, { end: e.target.value })}
                      disabled={!hours.enabled}
                      className="w-32"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>After Hours Message</Label>
                <Textarea
                  value={config.after_hours_message}
                  onChange={(e) => updateConfig({ after_hours_message: e.target.value })}
                  placeholder="Message played to callers outside business hours"
                  rows={3}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveCallHandlingSettings} disabled={saving}>
          {saving ? "Saving..." : "Save Call Handling Settings"}
        </Button>
      </div>
    </div>
  );
}