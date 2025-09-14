import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Bell, AlertTriangle, Mail, Smartphone, Slack } from "lucide-react";

interface AlertsSettingsProps {
  organizationId?: string;
}

interface AlertConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  threshold?: number;
  channels: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const defaultAlerts: AlertConfig[] = [
  {
    id: 'high_call_volume',
    name: 'High Call Volume',
    description: 'Alert when call volume exceeds threshold',
    enabled: true,
    threshold: 100,
    channels: ['email'],
    severity: 'medium'
  },
  {
    id: 'call_failure_rate',
    name: 'Call Failure Rate',
    description: 'Alert when call failure rate exceeds 5%',
    enabled: true,
    threshold: 5,
    channels: ['email', 'sms'],
    severity: 'high'
  },
  {
    id: 'low_balance',
    name: 'Low Account Balance',
    description: 'Alert when account balance is low',
    enabled: true,
    threshold: 50,
    channels: ['email'],
    severity: 'medium'
  },
  {
    id: 'agent_downtime',
    name: 'Agent Downtime',
    description: 'Alert when agents are unavailable',
    enabled: false,
    channels: ['email', 'slack'],
    severity: 'critical'
  }
];

export function AlertsSettings({ organizationId }: AlertsSettingsProps) {
  const [alerts, setAlerts] = useState<AlertConfig[]>(defaultAlerts);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (organizationId) {
      loadAlertSettings();
    }
  }, [organizationId]);

  const loadAlertSettings = async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('analytics_config')
        .eq('id', organizationId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.analytics_config && typeof data.analytics_config === 'object' && 'alert_config' in data.analytics_config) {
        setAlerts((data.analytics_config as any).alert_config as AlertConfig[]);
      }
    } catch (error) {
      console.error('Error loading alert settings:', error);
      toast({
        title: "Error",
        description: "Failed to load alert settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveAlertSettings = async () => {
    if (!organizationId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          analytics_config: { alert_config: alerts } as any
        })
        .eq('id', organizationId);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Alert settings have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving alert settings:', error);
      toast({
        title: "Error",
        description: "Failed to save alert settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateAlert = (alertId: string, updates: Partial<AlertConfig>) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, ...updates } : alert
    ));
  };

  const toggleChannel = (alertId: string, channel: string) => {
    setAlerts(prev => prev.map(alert => {
      if (alert.id === alertId) {
        const channels = alert.channels.includes(channel)
          ? alert.channels.filter(c => c !== channel)
          : [...alert.channels, channel];
        return { ...alert, channels };
      }
      return alert;
    }));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alerts & Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alerts & Notifications
          </CardTitle>
          <CardDescription>
            Configure automated alerts for important events and thresholds
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Alerts help you stay informed about critical events. Configure thresholds and notification channels below.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            {alerts.map((alert) => (
              <Card key={alert.id} className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={alert.enabled}
                      onCheckedChange={(enabled) => updateAlert(alert.id, { enabled })}
                    />
                    <div>
                      <h4 className="font-medium">{alert.name}</h4>
                      <p className="text-sm text-muted-foreground">{alert.description}</p>
                    </div>
                  </div>
                  <Badge className={getSeverityColor(alert.severity)}>
                    {alert.severity}
                  </Badge>
                </div>

                {alert.enabled && (
                  <div className="space-y-4 ml-6">
                    {alert.threshold !== undefined && (
                      <div className="flex items-center gap-4">
                        <Label htmlFor={`threshold-${alert.id}`} className="min-w-20">
                          Threshold:
                        </Label>
                        <Input
                          id={`threshold-${alert.id}`}
                          type="number"
                          value={alert.threshold}
                          onChange={(e) => updateAlert(alert.id, { threshold: parseInt(e.target.value) })}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">
                          {alert.id.includes('rate') ? '%' : 'calls'}
                        </span>
                      </div>
                    )}

                    <div>
                      <Label className="text-sm font-medium">Notification Channels:</Label>
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant={alert.channels.includes('email') ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleChannel(alert.id, 'email')}
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Email
                        </Button>
                        <Button
                          variant={alert.channels.includes('sms') ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleChannel(alert.id, 'sms')}
                        >
                          <Smartphone className="h-4 w-4 mr-1" />
                          SMS
                        </Button>
                        <Button
                          variant={alert.channels.includes('slack') ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleChannel(alert.id, 'slack')}
                        >
                          <Slack className="h-4 w-4 mr-1" />
                          Slack
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <Label htmlFor={`severity-${alert.id}`} className="min-w-20">
                        Severity:
                      </Label>
                      <Select
                        value={alert.severity}
                        onValueChange={(severity) => updateAlert(alert.id, { severity: severity as any })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={saveAlertSettings} disabled={saving}>
              {saving ? "Saving..." : "Save Alert Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}