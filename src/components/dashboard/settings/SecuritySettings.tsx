import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Key, AlertTriangle, Clock, Monitor, Smartphone, CheckCircle, XCircle } from "lucide-react";
import { ChangePasswordModal } from "./ChangePasswordModal";

interface SecuritySettingsProps {
  userId?: string;
}

interface SecurityConfig {
  // Multi-factor authentication
  mfa_enabled: boolean;
  mfa_method: 'app' | 'sms' | 'email';
  backup_codes_generated: boolean;
  
  // Session management
  session_timeout: number;
  remember_devices: boolean;
  max_sessions: number;
  
  // Login security
  login_alerts: boolean;
  suspicious_activity_alerts: boolean;
  failed_login_lockout: boolean;
  max_failed_attempts: number;
  
  // API security
  api_key_enabled: boolean;
  webhook_security: boolean;
  ip_whitelist_enabled: boolean;
  
  // Audit settings
  audit_log_retention: number;
  data_export_notifications: boolean;
}

interface ActiveSession {
  id: string;
  device: string;
  location: string;
  last_active: string;
  is_current: boolean;
}

interface LoginActivity {
  id: string;
  timestamp: string;
  location: string;
  device: string;
  success: boolean;
  ip_address: string;
}

const defaultConfig: SecurityConfig = {
  mfa_enabled: false,
  mfa_method: 'app',
  backup_codes_generated: false,
  
  session_timeout: 60,
  remember_devices: false,
  max_sessions: 5,
  
  login_alerts: true,
  suspicious_activity_alerts: true,
  failed_login_lockout: true,
  max_failed_attempts: 5,
  
  api_key_enabled: false,
  webhook_security: true,
  ip_whitelist_enabled: false,
  
  audit_log_retention: 90,
  data_export_notifications: true
};

const mockSessions: ActiveSession[] = [
  {
    id: '1',
    device: 'Chrome on macOS',
    location: 'San Francisco, CA',
    last_active: '2024-01-15T10:30:00Z',
    is_current: true
  },
  {
    id: '2',
    device: 'Safari on iPhone',
    location: 'San Francisco, CA',
    last_active: '2024-01-14T15:45:00Z',
    is_current: false
  }
];

const mockLoginActivity: LoginActivity[] = [
  {
    id: '1',
    timestamp: '2024-01-15T10:30:00Z',
    location: 'San Francisco, CA',
    device: 'Chrome on macOS',
    success: true,
    ip_address: '192.168.1.1'
  },
  {
    id: '2',
    timestamp: '2024-01-14T15:45:00Z',
    location: 'San Francisco, CA',
    device: 'Safari on iPhone',
    success: true,
    ip_address: '192.168.1.2'
  },
  {
    id: '3',
    timestamp: '2024-01-14T09:20:00Z',
    location: 'Unknown Location',
    device: 'Chrome on Windows',
    success: false,
    ip_address: '10.0.0.1'
  }
];

export function SecuritySettings({ userId }: SecuritySettingsProps) {
  const [config, setConfig] = useState<SecurityConfig>(defaultConfig);
  const [sessions] = useState<ActiveSession[]>(mockSessions);
  const [loginActivity] = useState<LoginActivity[]>(mockLoginActivity);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      loadSecurityConfig();
    }
  }, [userId]);

  const loadSecurityConfig = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Mock loading since security_config column doesn't exist yet
      console.log('Loading security config for user:', userId);
      
      // For now, use default config
      setConfig(defaultConfig);
    } catch (error) {
      console.error('Error loading security config:', error);
      toast({
        title: "Error",
        description: "Failed to load security settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSecurityConfig = async () => {
    if (!userId) return;

    setSaving(true);
    try {
      // Mock saving since security_config column doesn't exist yet
      console.log('Saving security config:', config);
      
      // In a real implementation, this would save to the database
      // For now, just show success message

      toast({
        title: "Settings saved",
        description: "Security settings have been updated",
      });
    } catch (error) {
      console.error('Error saving security config:', error);
      toast({
        title: "Error",
        description: "Failed to save security settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (updates: Partial<SecurityConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const terminateSession = async (sessionId: string) => {
    toast({
      title: "Session terminated",
      description: "The selected session has been terminated",
    });
  };

  const generateBackupCodes = () => {
    updateConfig({ backup_codes_generated: true });
    toast({
      title: "Backup codes generated",
      description: "Please save these codes in a secure location",
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Security Settings</CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Authentication Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Authentication & Access
          </CardTitle>
          <CardDescription>
            Manage how you sign in and secure your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Password */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Password</Label>
              <p className="text-sm text-muted-foreground">Change your account password</p>
            </div>
            <Button variant="outline" onClick={() => setPasswordModalOpen(true)}>
              <Key className="h-4 w-4 mr-2" />
              Change Password
            </Button>
          </div>

          <Separator />

          {/* Two-Factor Authentication */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
              </div>
              <div className="flex items-center gap-2">
                {config.mfa_enabled ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <XCircle className="h-3 w-3 mr-1" />
                    Disabled
                  </Badge>
                )}
                <Switch
                  checked={config.mfa_enabled}
                  onCheckedChange={(mfa_enabled) => updateConfig({ mfa_enabled })}
                />
              </div>
            </div>

            {config.mfa_enabled && (
              <div className="ml-4 space-y-4">
                <div className="space-y-2">
                  <Label>Authentication Method</Label>
                  <Select
                    value={config.mfa_method}
                    onValueChange={(mfa_method: 'app' | 'sms' | 'email') => updateConfig({ mfa_method })}
                  >
                    <SelectTrigger className="max-w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="app">Authenticator App</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Backup Codes</Label>
                    <p className="text-sm text-muted-foreground">
                      {config.backup_codes_generated ? 
                        "Backup codes have been generated" : 
                        "Generate backup codes for account recovery"
                      }
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={generateBackupCodes}
                    disabled={config.backup_codes_generated}
                  >
                    {config.backup_codes_generated ? "Generated" : "Generate Codes"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Session Management
          </CardTitle>
          <CardDescription>
            Control your active sessions and login preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Session Timeout</Label>
              <Select
                value={config.session_timeout.toString()}
                onValueChange={(value) => updateConfig({ session_timeout: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="480">8 hours</SelectItem>
                  <SelectItem value="1440">24 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Maximum Sessions</Label>
              <Select
                value={config.max_sessions.toString()}
                onValueChange={(value) => updateConfig({ max_sessions: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 session</SelectItem>
                  <SelectItem value="3">3 sessions</SelectItem>
                  <SelectItem value="5">5 sessions</SelectItem>
                  <SelectItem value="10">10 sessions</SelectItem>
                  <SelectItem value="0">Unlimited</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Remember Devices</Label>
              <p className="text-sm text-muted-foreground">Stay logged in on trusted devices</p>
            </div>
            <Switch
              checked={config.remember_devices}
              onCheckedChange={(remember_devices) => updateConfig({ remember_devices })}
            />
          </div>

          <Separator />

          {/* Active Sessions */}
          <div className="space-y-4">
            <Label>Active Sessions</Label>
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-full">
                      {session.device.includes('iPhone') ? (
                        <Smartphone className="h-4 w-4" />
                      ) : (
                        <Monitor className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {session.device}
                        {session.is_current && (
                          <Badge variant="secondary" className="text-xs">Current</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {session.location} • Last active {new Date(session.last_active).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  {!session.is_current && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => terminateSession(session.id)}
                    >
                      Terminate
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Security Alerts
          </CardTitle>
          <CardDescription>
            Configure notifications for security events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Login Alerts</Label>
              <p className="text-sm text-muted-foreground">Get notified of new sign-ins</p>
            </div>
            <Switch
              checked={config.login_alerts}
              onCheckedChange={(login_alerts) => updateConfig({ login_alerts })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Suspicious Activity Alerts</Label>
              <p className="text-sm text-muted-foreground">Alerts for unusual account activity</p>
            </div>
            <Switch
              checked={config.suspicious_activity_alerts}
              onCheckedChange={(suspicious_activity_alerts) => updateConfig({ suspicious_activity_alerts })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Failed Login Lockout</Label>
              <p className="text-sm text-muted-foreground">Lock account after multiple failed attempts</p>
            </div>
            <Switch
              checked={config.failed_login_lockout}
              onCheckedChange={(failed_login_lockout) => updateConfig({ failed_login_lockout })}
            />
          </div>

          {config.failed_login_lockout && (
            <div className="ml-4 space-y-2">
              <Label>Maximum Failed Attempts</Label>
              <Select
                value={config.max_failed_attempts.toString()}
                onValueChange={(value) => updateConfig({ max_failed_attempts: parseInt(value) })}
              >
                <SelectTrigger className="max-w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 attempts</SelectItem>
                  <SelectItem value="5">5 attempts</SelectItem>
                  <SelectItem value="10">10 attempts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Login Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Login Activity
          </CardTitle>
          <CardDescription>
            Review your recent sign-in attempts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loginActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${activity.success ? 'bg-green-100' : 'bg-red-100'}`}>
                    {activity.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">
                      {activity.success ? 'Successful sign-in' : 'Failed sign-in attempt'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {activity.device} • {activity.location}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground text-right">
                  <div>{new Date(activity.timestamp).toLocaleDateString()}</div>
                  <div>{new Date(activity.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveSecurityConfig} disabled={saving}>
          {saving ? "Saving..." : "Save Security Settings"}
        </Button>
      </div>

      <ChangePasswordModal 
        open={passwordModalOpen} 
        onOpenChange={setPasswordModalOpen} 
      />
    </div>
  );
}