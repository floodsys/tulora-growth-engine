import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Download, Save, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface RetentionConfig {
  audit_days: number;
  internal_days: number;
  test_invites_days: number;
}

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
        .select('retention_config')
        .eq('id', organizationId)
        .single();

      if (error) throw error;

      if (data?.retention_config && typeof data.retention_config === 'object') {
        const retentionConfig = data.retention_config as any;
        if (retentionConfig.audit_days && retentionConfig.internal_days && retentionConfig.test_invites_days) {
          setConfig(retentionConfig as RetentionConfig);
        }
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
      const { error } = await supabase
        .from('organizations')
        .update({ retention_config: config as any })
        .eq('id', organizationId);

      if (error) throw error;

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
                max="3650"
                value={config.audit_days}
                onChange={(e) => setConfig(prev => ({ ...prev, audit_days: parseInt(e.target.value) || 365 }))}
                disabled={!isOwner}
              />
              <p className="text-xs text-muted-foreground">Days to retain user-facing audit events</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="internal_days">
                Internal Events <Badge variant="secondary">Internal</Badge>
              </Label>
              <Input
                id="internal_days"
                type="number"
                min="1"
                max="365"
                value={config.internal_days}
                onChange={(e) => setConfig(prev => ({ ...prev, internal_days: parseInt(e.target.value) || 90 }))}
                disabled={!isOwner}
              />
              <p className="text-xs text-muted-foreground">Days to retain internal system events</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="test_invites_days">
                Test Events <Badge variant="destructive">Debug</Badge>
              </Label>
              <Input
                id="test_invites_days"
                type="number"
                min="1"
                max="90"
                value={config.test_invites_days}
                onChange={(e) => setConfig(prev => ({ ...prev, test_invites_days: parseInt(e.target.value) || 30 }))}
                disabled={!isOwner}
              />
              <p className="text-xs text-muted-foreground">Days to retain test and invite logs</p>
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