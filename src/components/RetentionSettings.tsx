import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Download, Save, Clock, Shield, Archive } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RetentionConfig {
  audit_days: number;
  internal_days: number;
  test_invites_days: number;
}

interface OrganizationSettings {
  retention_config: RetentionConfig;
  legal_hold_enabled: boolean;
  export_before_purge: {
    audit: boolean;
    internal: boolean;
    test_invites: boolean;
  };
}

interface RetentionSettingsProps {
  organizationId: string;
  isOwner: boolean;
}

const RETENTION_CAPS = {
  audit_days: 365,
  internal_days: 90,
  test_invites_days: 30,
} as const;

export function RetentionSettings({ organizationId, isOwner }: RetentionSettingsProps) {
  const [settings, setSettings] = useState<OrganizationSettings>({
    retention_config: {
      audit_days: 365,
      internal_days: 90,
      test_invites_days: 30
    },
    legal_hold_enabled: false,
    export_before_purge: {
      audit: false,
      internal: false,
      test_invites: false
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hasWarnings, setHasWarnings] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRetentionConfig();
  }, [organizationId]);

  const clampRetentionValues = (config: RetentionConfig): RetentionConfig => {
    return {
      audit_days: Math.min(config.audit_days, RETENTION_CAPS.audit_days),
      internal_days: Math.min(config.internal_days, RETENTION_CAPS.internal_days),
      test_invites_days: Math.min(config.test_invites_days, RETENTION_CAPS.test_invites_days)
    };
  };

  const loadRetentionConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('retention_config, legal_hold_enabled, export_before_purge')
        .eq('id', organizationId)
        .single();

      if (error) throw error;

      if (data) {
        const newSettings: OrganizationSettings = {
          retention_config: (data.retention_config as unknown as RetentionConfig) || {
            audit_days: 365,
            internal_days: 90,
            test_invites_days: 30
          },
          legal_hold_enabled: data.legal_hold_enabled || false,
          export_before_purge: (data.export_before_purge as { audit: boolean; internal: boolean; test_invites: boolean }) || {
            audit: false,
            internal: false,
            test_invites: false
          }
        };

        // Check if any values exceed caps and clamp them
        const clamped = clampRetentionValues(newSettings.retention_config);
        const hadExcess = JSON.stringify(clamped) !== JSON.stringify(newSettings.retention_config);
        
        if (hadExcess) {
          setHasWarnings(true);
          toast({
            title: "Retention Values Clamped",
            description: "Some retention periods exceeded maximum limits and were automatically adjusted.",
            variant: "destructive"
          });
        }

        setSettings({
          ...newSettings,
          retention_config: clamped
        });
      }
    } catch (error) {
      console.error('Error loading retention config:', error);
      toast({
        title: "Error",
        description: "Failed to load retention settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveRetentionConfig = async () => {
    if (!isOwner) return;

    setSaving(true);
    try {
      // Clamp values before saving
      const clampedConfig = clampRetentionValues(settings.retention_config);
      const hadExcess = JSON.stringify(clampedConfig) !== JSON.stringify(settings.retention_config);
      
      if (hadExcess) {
        setHasWarnings(true);
        setSettings(prev => ({ ...prev, retention_config: clampedConfig }));
        toast({
          title: "Values Clamped",
          description: "Some retention periods exceeded limits and were automatically adjusted.",
          variant: "destructive"
        });
      }

      const { error } = await supabase
        .from('organizations')
        .update({ 
          retention_config: clampedConfig as any,
          legal_hold_enabled: settings.legal_hold_enabled,
          export_before_purge: settings.export_before_purge as any
        })
        .eq('id', organizationId);

      if (error) throw error;

      setHasWarnings(false);
      toast({
        title: "Success",
        description: "Retention settings updated successfully"
      });
    } catch (error) {
      console.error('Error saving retention config:', error);
      toast({
        title: "Error",
        description: "Failed to save retention settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const exportLogsBeforePurge = async (channel?: string) => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-logs', {
        body: {
          organizationId,
          channel,
          format: 'json'
        }
      });

      if (error) throw error;

      // Create download link
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${channel || 'all'}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Exported ${data.count || 0} logs that would be purged`
      });
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast({
        title: "Error",
        description: "Failed to export logs",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Retention Settings</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Data Retention Settings
          </CardTitle>
          <CardDescription>
            Configure how long different types of audit logs are retained. Logs older than these periods will be automatically deleted during nightly cleanup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Changes to retention periods will take effect during the next nightly cleanup job. 
              Data deletion cannot be undone. Hard caps: Public ≤ 365, Internal ≤ 90, Test ≤ 30 days.
            </AlertDescription>
          </Alert>

          {hasWarnings && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                Some retention periods were automatically clamped to maximum allowed values.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="audit_days">
                Audit Events <Badge variant="outline">Public</Badge>
              </Label>
              <Input
                id="audit_days"
                type="number"
                min="1"
                max={RETENTION_CAPS.audit_days}
                value={settings.retention_config.audit_days}
                onChange={(e) => {
                  const value = Math.min(parseInt(e.target.value) || 365, RETENTION_CAPS.audit_days);
                  setSettings(prev => ({ 
                    ...prev, 
                    retention_config: { ...prev.retention_config, audit_days: value }
                  }));
                }}
                disabled={!isOwner}
                className={settings.retention_config.audit_days >= RETENTION_CAPS.audit_days ? 'border-orange-300' : ''}
              />
              <p className="text-xs text-muted-foreground">
                Days to retain user-facing audit events (max: {RETENTION_CAPS.audit_days})
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="internal_days">
                Internal Events <Badge variant="secondary">Internal</Badge>
              </Label>
              <Input
                id="internal_days"
                type="number"
                min="1"
                max={RETENTION_CAPS.internal_days}
                value={settings.retention_config.internal_days}
                onChange={(e) => {
                  const value = Math.min(parseInt(e.target.value) || 90, RETENTION_CAPS.internal_days);
                  setSettings(prev => ({ 
                    ...prev, 
                    retention_config: { ...prev.retention_config, internal_days: value }
                  }));
                }}
                disabled={!isOwner}
                className={settings.retention_config.internal_days >= RETENTION_CAPS.internal_days ? 'border-orange-300' : ''}
              />
              <p className="text-xs text-muted-foreground">
                Days to retain internal system events (max: {RETENTION_CAPS.internal_days})
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="test_invites_days">
                Test Events <Badge variant="destructive">Debug</Badge>
              </Label>
              <Input
                id="test_invites_days"
                type="number"
                min="1"
                max={RETENTION_CAPS.test_invites_days}
                value={settings.retention_config.test_invites_days}
                onChange={(e) => {
                  const value = Math.min(parseInt(e.target.value) || 30, RETENTION_CAPS.test_invites_days);
                  setSettings(prev => ({ 
                    ...prev, 
                    retention_config: { ...prev.retention_config, test_invites_days: value }
                  }));
                }}
                disabled={!isOwner}
                className={settings.retention_config.test_invites_days >= RETENTION_CAPS.test_invites_days ? 'border-orange-300' : ''}
              />
              <p className="text-xs text-muted-foreground">
                Days to retain test and invite logs (max: {RETENTION_CAPS.test_invites_days})
              </p>
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Legal Hold (Audit Only)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Pause deletion of audit logs for legal compliance. Internal and test logs still purge normally.
                </p>
              </div>
              <Switch
                checked={settings.legal_hold_enabled}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, legal_hold_enabled: checked }))
                }
                disabled={!isOwner}
              />
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <Label className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              Export Before Purge
            </Label>
            <p className="text-xs text-muted-foreground mb-3">
              Automatically export logs to storage before deletion during nightly cleanup.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="export_audit" className="text-sm">Audit Events</Label>
                <Switch
                  id="export_audit"
                  checked={settings.export_before_purge.audit}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ 
                      ...prev, 
                      export_before_purge: { ...prev.export_before_purge, audit: checked }
                    }))
                  }
                  disabled={!isOwner}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="export_internal" className="text-sm">Internal Events</Label>
                <Switch
                  id="export_internal"
                  checked={settings.export_before_purge.internal}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ 
                      ...prev, 
                      export_before_purge: { ...prev.export_before_purge, internal: checked }
                    }))
                  }
                  disabled={!isOwner}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="export_test" className="text-sm">Test Events</Label>
                <Switch
                  id="export_test"
                  checked={settings.export_before_purge.test_invites}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ 
                      ...prev, 
                      export_before_purge: { ...prev.export_before_purge, test_invites: checked }
                    }))
                  }
                  disabled={!isOwner}
                />
              </div>
            </div>
          </div>

          {isOwner && (
            <Button onClick={saveRetentionConfig} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Retention Settings'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export Before Purge (Manual)</CardTitle>
          <CardDescription>
            Export logs that would be deleted based on current retention settings. 
            This allows you to backup data before it's automatically purged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This export includes only logs that are scheduled for deletion based on your current retention settings.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              onClick={() => exportLogsBeforePurge()}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-2" />
              Export All Expiring Logs
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => exportLogsBeforePurge('audit')}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Audit Logs
            </Button>

            <Button 
              variant="outline" 
              onClick={() => exportLogsBeforePurge('internal')}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Internal Logs
            </Button>

            <Button 
              variant="outline" 
              onClick={() => exportLogsBeforePurge('test_invites')}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Test Logs
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}