import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, Download, Save, Clock, Shield, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface RetentionConfig {
  audit_days: number;
  internal_days: number;
  test_invites_days: number;
}

interface ExportConfig {
  audit: boolean;
  internal: boolean;
  test_invites: boolean;
}

// Hard caps
const RETENTION_CAPS = {
  audit_days: 365,
  internal_days: 90,
  test_invites_days: 30,
} as const;

interface RetentionSettingsProps {
  organizationId: string;
  isOwner: boolean;
}

export function RetentionSettings({ organizationId, isOwner }: RetentionSettingsProps) {
  const [config, setConfig] = useState<RetentionConfig>({
    audit_days: 365,
    internal_days: 90,
    test_invites_days: 30
  });
  const [legalHoldEnabled, setLegalHoldEnabled] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    audit: false,
    internal: false,
    test_invites: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRetentionConfig();
  }, [organizationId]);

  const loadRetentionConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('retention_config, legal_hold_enabled, export_before_purge')
        .eq('id', organizationId)
        .single();

      if (error) throw error;

      // Load retention config
      if (data?.retention_config && typeof data.retention_config === 'object') {
        const retentionConfig = data.retention_config as any;
        if (retentionConfig.audit_days && retentionConfig.internal_days && retentionConfig.test_invites_days) {
          setConfig(retentionConfig as RetentionConfig);
        }
      }

      // Load legal hold setting
      if (typeof data?.legal_hold_enabled === 'boolean') {
        setLegalHoldEnabled(data.legal_hold_enabled);
      }

      // Load export config
      if (data?.export_before_purge && typeof data.export_before_purge === 'object' && !Array.isArray(data.export_before_purge)) {
        const exportData = data.export_before_purge as any;
        setExportConfig({
          audit: Boolean(exportData.audit),
          internal: Boolean(exportData.internal),
          test_invites: Boolean(exportData.test_invites)
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
      // Apply hard caps and check for warnings
      const clampedConfig = {
        audit_days: Math.min(config.audit_days, RETENTION_CAPS.audit_days),
        internal_days: Math.min(config.internal_days, RETENTION_CAPS.internal_days),
        test_invites_days: Math.min(config.test_invites_days, RETENTION_CAPS.test_invites_days),
      };

      // Check if any values were clamped
      const wasClamped = 
        clampedConfig.audit_days !== config.audit_days ||
        clampedConfig.internal_days !== config.internal_days ||
        clampedConfig.test_invites_days !== config.test_invites_days;

      const { error } = await supabase
        .from('organizations')
        .update({ 
          retention_config: clampedConfig as any,
          legal_hold_enabled: legalHoldEnabled,
          export_before_purge: exportConfig as any
        })
        .eq('id', organizationId);

      if (error) throw error;

      // Update local state with clamped values
      setConfig(clampedConfig);

      toast({
        title: "Success",
        description: wasClamped 
          ? "Retention settings updated. Some values were adjusted to comply with limits."
          : "Retention settings updated successfully",
        variant: wasClamped ? "default" : "default"
      });

      if (wasClamped) {
        toast({
          title: "Values Adjusted",
          description: `Some retention periods exceeded limits and were clamped to: Public ≤ ${RETENTION_CAPS.audit_days}, Internal ≤ ${RETENTION_CAPS.internal_days}, Test ≤ ${RETENTION_CAPS.test_invites_days} days.`,
          variant: "destructive"
        });
      }
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
            Configure how long different types of audit logs are retained. Logs older than these periods will be automatically deleted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Changes to retention periods will take effect during the next nightly cleanup job. 
              Data deletion cannot be undone.
            </AlertDescription>
          </Alert>

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
                value={config.audit_days}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 1;
                  setConfig(prev => ({ ...prev, audit_days: Math.min(value, RETENTION_CAPS.audit_days) }));
                }}
                disabled={!isOwner}
                className={config.audit_days > RETENTION_CAPS.audit_days ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground">
                Days to retain user-facing audit events (max {RETENTION_CAPS.audit_days})
                {legalHoldEnabled && <span className="text-amber-600 block">• Legal hold active - no deletions</span>}
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
                value={config.internal_days}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 1;
                  setConfig(prev => ({ ...prev, internal_days: Math.min(value, RETENTION_CAPS.internal_days) }));
                }}
                disabled={!isOwner}
                className={config.internal_days > RETENTION_CAPS.internal_days ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground">Days to retain internal system events (max {RETENTION_CAPS.internal_days})</p>
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
                value={config.test_invites_days}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 1;
                  setConfig(prev => ({ ...prev, test_invites_days: Math.min(value, RETENTION_CAPS.test_invites_days) }));
                }}
                disabled={!isOwner}
                className={config.test_invites_days > RETENTION_CAPS.test_invites_days ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground">Days to retain test and invite logs (max {RETENTION_CAPS.test_invites_days})</p>
            </div>
          </div>

          {/* Legal Hold Section */}
          <div className="border-t pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="legal_hold" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Legal Hold
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Prevents deletion of public audit logs. Internal and test logs are still purged.
                  </p>
                </div>
                <Switch
                  id="legal_hold"
                  checked={legalHoldEnabled}
                  onCheckedChange={setLegalHoldEnabled}
                  disabled={!isOwner}
                />
              </div>
            </div>
          </div>

          {/* Export Before Purge Section */}
          <div className="border-t pt-6">
            <div className="space-y-4">
              <div>
                <Label className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Export Before Purge
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically export logs to storage before deletion during nightly cleanup.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="export_audit" className="text-sm">Export Audit Logs</Label>
                  <Switch
                    id="export_audit"
                    checked={exportConfig.audit}
                    onCheckedChange={(checked) => setExportConfig(prev => ({ ...prev, audit: checked }))}
                    disabled={!isOwner}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="export_internal" className="text-sm">Export Internal Logs</Label>
                  <Switch
                    id="export_internal"
                    checked={exportConfig.internal}
                    onCheckedChange={(checked) => setExportConfig(prev => ({ ...prev, internal: checked }))}
                    disabled={!isOwner}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="export_test" className="text-sm">Export Test Logs</Label>
                  <Switch
                    id="export_test"
                    checked={exportConfig.test_invites}
                    onCheckedChange={(checked) => setExportConfig(prev => ({ ...prev, test_invites: checked }))}
                    disabled={!isOwner}
                  />
                </div>
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
          <CardTitle>Export Before Purge</CardTitle>
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