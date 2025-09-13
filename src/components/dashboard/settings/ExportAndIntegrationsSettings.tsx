import { useState } from "react";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { shouldShowChannel, getEnvironmentConfig } from "@/lib/environment";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, Webhook, BarChart3, Calendar, FileJson, FileText, TestTube } from "lucide-react";

export function ExportAndIntegrationsSettings() {
  const { organization, isOwner } = useUserOrganization();
  const [loading, setLoading] = useState(false);
  
  // Export state
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  const [exportChannel, setExportChannel] = useState('');

  // Webhook state
  const [webhookConfig, setWebhookConfig] = useState({
    enabled: false,
    url: '',
    secret: '',
    filters: {
      channels: [] as string[],
      actions: [] as string[]
    },
    retry_config: {
      max_retries: 3,
      initial_delay: 1000
    }
  });

  // Analytics state
  const [analyticsConfig, setAnalyticsConfig] = useState({
    enabled: false,
    opted_out: false,
    posthog: {
      enabled: false,
      api_key: '',
      host: 'https://app.posthog.com'
    },
    segment: {
      enabled: false,
      write_key: ''
    }
  });

  // Zapier webhook state
  const [zapierWebhookUrl, setZapierWebhookUrl] = useState('');

  const exportAuditLogs = async () => {
    if (!organization?.id) return;

    try {
      setLoading(true);
      
      const exportData = {
        organization_id: organization.id,
        format: exportFormat,
        ...(exportDateFrom && { date_from: exportDateFrom }),
        ...(exportDateTo && { date_to: exportDateTo }),
        ...(exportChannel && { channel: exportChannel })
      };

      const { data, error } = await supabase.functions.invoke('export-audit-logs', {
        body: exportData
      });

      if (error) {
        console.error('Export error:', error);
        toast.error('Failed to export audit logs');
        return;
      }

      // Create and download file
      const blob = new Blob([
        exportFormat === 'json' ? JSON.stringify(data, null, 2) : data
      ], {
        type: exportFormat === 'json' ? 'application/json' : 'text/csv'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${organization.id}-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Audit logs exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export audit logs');
    } finally {
      setLoading(false);
    }
  };

  const saveWebhookConfig = async () => {
    if (!organization?.id) return;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('organizations')
        .update({ webhook_config: webhookConfig })
        .eq('id', organization.id);

      if (error) {
        console.error('Webhook config error:', error);
        toast.error('Failed to save webhook configuration');
      } else {
        toast.success('Webhook configuration saved successfully');
      }
    } catch (error) {
      console.error('Webhook config error:', error);
      toast.error('Failed to save webhook configuration');
    } finally {
      setLoading(false);
    }
  };

  const saveAnalyticsConfig = async () => {
    if (!organization?.id) return;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('organizations')
        .update({ analytics_config: analyticsConfig })
        .eq('id', organization.id);

      if (error) {
        console.error('Analytics config error:', error);
        toast.error('Failed to save analytics configuration');
      } else {
        toast.success('Analytics configuration saved successfully');
      }
    } catch (error) {
      console.error('Analytics config error:', error);
      toast.error('Failed to save analytics configuration');
    } finally {
      setLoading(false);
    }
  };

  const testZapierWebhook = async () => {
    if (!zapierWebhookUrl) {
      toast.error('Please enter your Zapier webhook URL');
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(zapierWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'no-cors',
        body: JSON.stringify({
          event_type: 'test',
          organization_id: organization?.id,
          timestamp: new Date().toISOString(),
          message: 'Test webhook from audit log system',
          triggered_from: window.location.origin,
        }),
      });

      toast.success('Test webhook sent! Check your Zap history to confirm it was triggered.');
    } catch (error) {
      console.error('Zapier webhook error:', error);
      toast.error('Failed to trigger the Zapier webhook. Please check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Only organization owners can manage exports and integrations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Exports & Integrations</h3>
        <p className="text-sm text-muted-foreground">
          Export audit data and configure integrations with external services
        </p>
      </div>

      <Tabs defaultValue="export" className="space-y-4">
        <TabsList>
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="zapier" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Zapier
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Audit Logs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="export-format">Format</Label>
                  <Select value={exportFormat} onValueChange={(value: 'csv' | 'json') => setExportFormat(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          CSV
                        </div>
                      </SelectItem>
                      <SelectItem value="json">
                        <div className="flex items-center gap-2">
                          <FileJson className="h-4 w-4" />
                          JSON
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="export-channel">Channel (optional)</Label>
                  <Select value={exportChannel} onValueChange={setExportChannel}>
                    <SelectTrigger>
                      <SelectValue placeholder="All channels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All channels</SelectItem>
                      <SelectItem value="audit">Audit</SelectItem>
                      {shouldShowChannel('internal', isOwner ? 'owner' : 'member', 'active') && (
                        <SelectItem value="internal">Internal</SelectItem>
                      )}
                      {shouldShowChannel('test_invites', isOwner ? 'owner' : 'member', 'active') && (
                        <SelectItem value="test_invites">Test Invites</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="export-date-from">From Date (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={exportDateFrom}
                    onChange={(e) => setExportDateFrom(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="export-date-to">To Date (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={exportDateTo}
                    onChange={(e) => setExportDateTo(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={exportAuditLogs} disabled={loading}>
                <Download className="h-4 w-4 mr-2" />
                {loading ? 'Exporting...' : 'Export Logs'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhook Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Webhooks</Label>
                  <p className="text-sm text-muted-foreground">
                    Send audit events to external services like Slack or SIEM
                  </p>
                </div>
                <Switch
                  checked={webhookConfig.enabled}
                  onCheckedChange={(enabled) => 
                    setWebhookConfig(prev => ({ ...prev, enabled }))
                  }
                />
              </div>

              {webhookConfig.enabled && (
                <>
                  <div>
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <Input
                      placeholder="https://your-endpoint.com/webhook"
                      value={webhookConfig.url}
                      onChange={(e) => 
                        setWebhookConfig(prev => ({ ...prev, url: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="webhook-secret">Secret (for HMAC signing)</Label>
                    <Input
                      type="password"
                      placeholder="Optional secret for signature verification"
                      value={webhookConfig.secret}
                      onChange={(e) => 
                        setWebhookConfig(prev => ({ ...prev, secret: e.target.value }))
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Used to generate X-Signature-256 header for webhook verification
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Channel Filters</Label>
                    <div className="flex gap-2">
                      {['audit', 'internal'].map(channel => (
                        shouldShowChannel(channel, isOwner ? 'owner' : 'member', 'active') && (
                          <div key={channel} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={channel}
                              checked={webhookConfig.filters.channels.includes(channel)}
                              onChange={(e) => {
                                const channels = e.target.checked
                                  ? [...webhookConfig.filters.channels, channel]
                                  : webhookConfig.filters.channels.filter(c => c !== channel);
                                setWebhookConfig(prev => ({
                                  ...prev,
                                  filters: { ...prev.filters, channels }
                                }));
                              }}
                            />
                            <Label htmlFor={channel} className="text-sm">
                              {channel}
                            </Label>
                          </div>
                        )
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Note: Test channels are automatically excluded from webhooks
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Max Retries</Label>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        value={webhookConfig.retry_config.max_retries}
                        onChange={(e) => 
                          setWebhookConfig(prev => ({
                            ...prev,
                            retry_config: {
                              ...prev.retry_config,
                              max_retries: parseInt(e.target.value) || 3
                            }
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Initial Delay (ms)</Label>
                      <Input
                        type="number"
                        min="100"
                        value={webhookConfig.retry_config.initial_delay}
                        onChange={(e) => 
                          setWebhookConfig(prev => ({
                            ...prev,
                            retry_config: {
                              ...prev.retry_config,
                              initial_delay: parseInt(e.target.value) || 1000
                            }
                          }))
                        }
                      />
                    </div>
                  </div>
                </>
              )}

              <Button onClick={saveWebhookConfig} disabled={loading}>
                {loading ? 'Saving...' : 'Save Webhook Configuration'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analytics Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Analytics</Label>
                  <p className="text-sm text-muted-foreground">
                    Send PII-safe audit events to analytics platforms
                  </p>
                </div>
                <Switch
                  checked={analyticsConfig.enabled && !analyticsConfig.opted_out}
                  onCheckedChange={(enabled) => 
                    setAnalyticsConfig(prev => ({ ...prev, enabled, opted_out: !enabled }))
                  }
                />
              </div>

              {analyticsConfig.enabled && !analyticsConfig.opted_out && (
                <>
                  <Separator />
                  
                  <div className="space-y-4">
                    <h4 className="font-medium">PostHog Integration</h4>
                    <div className="flex items-center justify-between">
                      <Label>Enable PostHog</Label>
                      <Switch
                        checked={analyticsConfig.posthog.enabled}
                        onCheckedChange={(enabled) => 
                          setAnalyticsConfig(prev => ({
                            ...prev,
                            posthog: { ...prev.posthog, enabled }
                          }))
                        }
                      />
                    </div>
                    
                    {analyticsConfig.posthog.enabled && (
                      <>
                        <div>
                          <Label>PostHog API Key</Label>
                          <Input
                            type="password"
                            placeholder="phc_..."
                            value={analyticsConfig.posthog.api_key}
                            onChange={(e) => 
                              setAnalyticsConfig(prev => ({
                                ...prev,
                                posthog: { ...prev.posthog, api_key: e.target.value }
                              }))
                            }
                          />
                        </div>
                        
                        <div>
                          <Label>PostHog Host</Label>
                          <Input
                            placeholder="https://app.posthog.com"
                            value={analyticsConfig.posthog.host}
                            onChange={(e) => 
                              setAnalyticsConfig(prev => ({
                                ...prev,
                                posthog: { ...prev.posthog, host: e.target.value }
                              }))
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <Separator />
                  
                  <div className="space-y-4">
                    <h4 className="font-medium">Segment Integration</h4>
                    <div className="flex items-center justify-between">
                      <Label>Enable Segment</Label>
                      <Switch
                        checked={analyticsConfig.segment.enabled}
                        onCheckedChange={(enabled) => 
                          setAnalyticsConfig(prev => ({
                            ...prev,
                            segment: { ...prev.segment, enabled }
                          }))
                        }
                      />
                    </div>
                    
                    {analyticsConfig.segment.enabled && (
                      <div>
                        <Label>Segment Write Key</Label>
                        <Input
                          type="password"
                          placeholder="Your Segment write key"
                          value={analyticsConfig.segment.write_key}
                          onChange={(e) => 
                            setAnalyticsConfig(prev => ({
                              ...prev,
                              segment: { ...prev.segment, write_key: e.target.value }
                            }))
                          }
                        />
                      </div>
                    )}
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Privacy & Environment Notice</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Only non-PII metadata is sent to analytics platforms</li>
                      <li>• Personal information like emails, IP addresses, and user agents are filtered out</li>
                      <li>• Test channels (test_invites) are automatically excluded from analytics</li>
                      <li>• Internal diagnostic data is only included when explicitly configured</li>
                    </ul>
                  </div>
                </>
              )}

              <Button onClick={saveAnalyticsConfig} disabled={loading}>
                {loading ? 'Saving...' : 'Save Analytics Configuration'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zapier">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Zapier Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="zapier-webhook">Zapier Webhook URL</Label>
                <Input
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  value={zapierWebhookUrl}
                  onChange={(e) => setZapierWebhookUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Create a Zap with a webhook trigger and paste the URL here
                </p>
              </div>

              <Button onClick={testZapierWebhook} disabled={loading || !zapierWebhookUrl}>
                {loading ? 'Testing...' : 'Test Zapier Webhook'}
              </Button>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Setup Instructions</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Go to Zapier and create a new Zap</li>
                  <li>Choose "Webhooks by Zapier" as your trigger</li>
                  <li>Select "Catch Hook" as the trigger event</li>
                  <li>Copy the webhook URL and paste it above</li>
                  <li>Click "Test Zapier Webhook" to verify the connection</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}