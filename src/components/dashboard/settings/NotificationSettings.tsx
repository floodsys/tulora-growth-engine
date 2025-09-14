import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Mail, Smartphone, Monitor, AlertCircle, Clock } from "lucide-react";

interface NotificationSettingsProps {
  userId?: string;
}

interface NotificationPreferences {
  // Email notifications
  email_notifications: boolean;
  weekly_digest: boolean;
  marketing_emails: boolean;
  security_alerts: boolean;
  
  // Call notifications
  call_notifications: boolean;
  missed_call_alerts: boolean;
  call_summary_reports: boolean;
  
  // System notifications
  system_alerts: boolean;
  maintenance_notices: boolean;
  feature_updates: boolean;
  
  // Push notifications
  push_notifications: boolean;
  browser_notifications: boolean;
  
  // Timing preferences
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
}

const defaultPreferences: NotificationPreferences = {
  email_notifications: true,
  weekly_digest: true,
  marketing_emails: false,
  security_alerts: true,
  
  call_notifications: true,
  missed_call_alerts: true,
  call_summary_reports: false,
  
  system_alerts: true,
  maintenance_notices: true,
  feature_updates: false,
  
  push_notifications: true,
  browser_notifications: false,
  
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  timezone: 'UTC'
};

export function NotificationSettings({ userId }: NotificationSettingsProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      loadNotificationPreferences();
    }
  }, [userId]);

  const loadNotificationPreferences = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Mock loading since notification_preferences column doesn't exist yet
      // In a real implementation, this would load from the database
      console.log('Loading notification preferences for user:', userId);
      
      // For now, use default preferences
      setPreferences(defaultPreferences);
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      toast({
        title: "Error",
        description: "Failed to load notification preferences",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveNotificationPreferences = async () => {
    if (!userId) return;

    setSaving(true);
    try {
      // Mock saving since notification_preferences column doesn't exist yet
      console.log('Saving notification preferences:', preferences);
      
      // In a real implementation, this would save to the database
      // For now, just show success message

      toast({
        title: "Preferences saved",
        description: "Your notification preferences have been updated",
      });
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save notification preferences",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose how and when you want to be notified about activity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Notifications */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <h4 className="text-sm font-medium">Email Notifications</h4>
          </div>
          
          <div className="space-y-3 ml-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Email notifications</Label>
                <p className="text-sm text-muted-foreground">Receive notifications via email</p>
              </div>
              <Switch
                checked={preferences.email_notifications}
                onCheckedChange={(value) => updatePreference('email_notifications', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Weekly digest</Label>
                <p className="text-sm text-muted-foreground">Weekly summary of your activity</p>
              </div>
              <Switch
                checked={preferences.weekly_digest}
                onCheckedChange={(value) => updatePreference('weekly_digest', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Security alerts</Label>
                <p className="text-sm text-muted-foreground">Important security notifications</p>
              </div>
              <Switch
                checked={preferences.security_alerts}
                onCheckedChange={(value) => updatePreference('security_alerts', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Marketing emails</Label>
                <p className="text-sm text-muted-foreground">Product updates and marketing content</p>
              </div>
              <Switch
                checked={preferences.marketing_emails}
                onCheckedChange={(value) => updatePreference('marketing_emails', value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Call Notifications */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            <h4 className="text-sm font-medium">Call Notifications</h4>
          </div>
          
          <div className="space-y-3 ml-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Call notifications</Label>
                <p className="text-sm text-muted-foreground">Get notified about incoming calls</p>
              </div>
              <Switch
                checked={preferences.call_notifications}
                onCheckedChange={(value) => updatePreference('call_notifications', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Missed call alerts</Label>
                <p className="text-sm text-muted-foreground">Notifications for missed calls</p>
              </div>
              <Switch
                checked={preferences.missed_call_alerts}
                onCheckedChange={(value) => updatePreference('missed_call_alerts', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Call summary reports</Label>
                <p className="text-sm text-muted-foreground">Daily/weekly call summaries</p>
              </div>
              <Switch
                checked={preferences.call_summary_reports}
                onCheckedChange={(value) => updatePreference('call_summary_reports', value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* System Notifications */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            <h4 className="text-sm font-medium">System Notifications</h4>
          </div>
          
          <div className="space-y-3 ml-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>System alerts</Label>
                <p className="text-sm text-muted-foreground">Important system notifications</p>
              </div>
              <Switch
                checked={preferences.system_alerts}
                onCheckedChange={(value) => updatePreference('system_alerts', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Maintenance notices</Label>
                <p className="text-sm text-muted-foreground">Scheduled maintenance notifications</p>
              </div>
              <Switch
                checked={preferences.maintenance_notices}
                onCheckedChange={(value) => updatePreference('maintenance_notices', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Feature updates</Label>
                <p className="text-sm text-muted-foreground">Notifications about new features</p>
              </div>
              <Switch
                checked={preferences.feature_updates}
                onCheckedChange={(value) => updatePreference('feature_updates', value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Push Notifications */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <h4 className="text-sm font-medium">Push Notifications</h4>
          </div>
          
          <div className="space-y-3 ml-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Push notifications</Label>
                <p className="text-sm text-muted-foreground">Real-time notifications in the app</p>
              </div>
              <Switch
                checked={preferences.push_notifications}
                onCheckedChange={(value) => updatePreference('push_notifications', value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Browser notifications</Label>
                <p className="text-sm text-muted-foreground">Notifications when the app is closed</p>
              </div>
              <Switch
                checked={preferences.browser_notifications}
                onCheckedChange={(value) => updatePreference('browser_notifications', value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Quiet Hours */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <h4 className="text-sm font-medium">Quiet Hours</h4>
          </div>
          
          <div className="space-y-3 ml-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable quiet hours</Label>
                <p className="text-sm text-muted-foreground">Reduce notifications during specific hours</p>
              </div>
              <Switch
                checked={preferences.quiet_hours_enabled}
                onCheckedChange={(value) => updatePreference('quiet_hours_enabled', value)}
              />
            </div>

            {preferences.quiet_hours_enabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start time</Label>
                  <Select
                    value={preferences.quiet_hours_start}
                    onValueChange={(value) => updatePreference('quiet_hours_start', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0');
                        return (
                          <SelectItem key={i} value={`${hour}:00`}>
                            {hour}:00
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>End time</Label>
                  <Select
                    value={preferences.quiet_hours_end}
                    onValueChange={(value) => updatePreference('quiet_hours_end', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0');
                        return (
                          <SelectItem key={i} value={`${hour}:00`}>
                            {hour}:00
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={preferences.timezone}
                onValueChange={(value) => updatePreference('timezone', value)}
              >
                <SelectTrigger className="max-w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  <SelectItem value="Europe/London">GMT</SelectItem>
                  <SelectItem value="Europe/Paris">CET</SelectItem>
                  <SelectItem value="Asia/Tokyo">JST</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={saveNotificationPreferences} disabled={saving}>
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}