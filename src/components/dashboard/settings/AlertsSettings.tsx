import { useState, useEffect } from "react";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, Clock, Eye, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Alert {
  id: string;
  rule_name: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  threshold_data: any;
  source_events: any;
}

interface AlertRule {
  id: string;
  rule_name: string;
  description: string;
  conditions: any;
  threshold_count: number;
  time_window_minutes: number;
  severity: string;
  is_enabled: boolean;
}

export function AlertsSettings() {
  const { organization, isOwner } = useUserOrganization();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  useEffect(() => {
    if (organization?.id) {
      loadAlertsData();
    }
  }, [organization?.id]);

  const loadAlertsData = async () => {
    if (!organization?.id) return;

    try {
      setLoading(true);

      // Load alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('alerts')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (alertsError) {
        console.error('Error loading alerts:', alertsError);
        toast.error('Failed to load alerts');
      } else {
        setAlerts(alertsData || []);
      }

      // Load alert rules
      const { data: rulesData, error: rulesError } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('organization_id', organization.id)
        .order('rule_name');

      if (rulesError) {
        console.error('Error loading alert rules:', rulesError);
        toast.error('Failed to load alert rules');
      } else {
        setAlertRules(rulesData || []);
      }

    } catch (error) {
      console.error('Error in loadAlertsData:', error);
      toast.error('Failed to load alerts data');
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', alertId);

      if (error) {
        console.error('Error resolving alert:', error);
        toast.error('Failed to resolve alert');
      } else {
        toast.success('Alert resolved successfully');
        loadAlertsData();
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Failed to resolve alert');
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('alert_rules')
        .update({ is_enabled: enabled })
        .eq('id', ruleId);

      if (error) {
        console.error('Error updating rule:', error);
        toast.error('Failed to update rule');
      } else {
        toast.success(`Rule ${enabled ? 'enabled' : 'disabled'} successfully`);
        loadAlertsData();
      }
    } catch (error) {
      console.error('Error updating rule:', error);
      toast.error('Failed to update rule');
    }
  };

  const checkAlerts = async () => {
    if (!organization?.id) return;

    try {
      const { error } = await supabase.functions.invoke('check-alerts', {
        body: { organization_id: organization.id }
      });

      if (error) {
        console.error('Error checking alerts:', error);
        toast.error('Failed to check alerts');
      } else {
        toast.success('Alert check completed');
        loadAlertsData();
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
      toast.error('Failed to check alerts');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    return status === 'resolved' ? 
      <CheckCircle className="h-4 w-4 text-green-600" /> : 
      <AlertTriangle className="h-4 w-4 text-yellow-600" />;
  };

  const getRuleDisplayName = (ruleName: string) => {
    const displayNames: Record<string, string> = {
      'rapid_role_changes': 'Rapid Role Changes',
      'failed_invite_acceptances': 'Failed Invite Acceptances',
      'billing_payment_failures': 'Billing Payment Failures',
      'rls_authorization_failures': 'Authorization Failures',
      'blocked_operations_threshold': 'Blocked Operations Threshold'
    };
    return displayNames[ruleName] || ruleName;
  };

  if (!isOwner) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Only organization owners can manage alerts.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading alerts...</p>
      </div>
    );
  }

  const activeAlerts = alerts.filter(alert => alert.status === 'active');
  const resolvedAlerts = alerts.filter(alert => alert.status === 'resolved');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Security Alerts</h3>
          <p className="text-sm text-muted-foreground">
            Monitor security events and anomalies in your organization
          </p>
        </div>
        <Button onClick={checkAlerts} variant="outline">
          Check Alerts Now
        </Button>
      </div>

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Active Alerts ({activeAlerts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeAlerts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No active alerts</p>
          ) : (
            <div className="space-y-3">
              {activeAlerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getSeverityIcon(alert.severity)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{alert.title}</span>
                        <Badge variant={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedAlert(alert)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent>
                        <SheetHeader>
                          <SheetTitle>Alert Details</SheetTitle>
                        </SheetHeader>
                        {selectedAlert && (
                          <div className="space-y-4 mt-4">
                            <div>
                              <h4 className="font-medium">Alert Information</h4>
                              <div className="space-y-2 text-sm">
                                <p><strong>Title:</strong> {selectedAlert.title}</p>
                                <p><strong>Severity:</strong> 
                                  <Badge variant={getSeverityColor(selectedAlert.severity)} className="ml-2">
                                    {selectedAlert.severity}
                                  </Badge>
                                </p>
                                <p><strong>Rule:</strong> {getRuleDisplayName(selectedAlert.rule_name)}</p>
                                <p><strong>Created:</strong> {new Date(selectedAlert.created_at).toLocaleString()}</p>
                              </div>
                            </div>
                            
                            <Separator />
                            
                            <div>
                              <h4 className="font-medium">Threshold Data</h4>
                              <div className="space-y-2 text-sm">
                                <p><strong>Events:</strong> {selectedAlert.threshold_data.event_count}</p>
                                <p><strong>Threshold:</strong> {selectedAlert.threshold_data.threshold}</p>
                                <p><strong>Time Window:</strong> {selectedAlert.threshold_data.time_window_minutes} minutes</p>
                              </div>
                            </div>
                            
                            <Separator />
                            
                            <div>
                              <h4 className="font-medium">Source Events ({selectedAlert.source_events.length})</h4>
                              <ScrollArea className="h-32">
                                <div className="space-y-2 text-xs">
                                  {selectedAlert.source_events.map((event, index) => (
                                    <div key={index} className="p-2 bg-muted rounded">
                                      <p><strong>Action:</strong> {event.action}</p>
                                      <p><strong>Time:</strong> {new Date(event.created_at).toLocaleString()}</p>
                                      {event.target_id && <p><strong>Target:</strong> {event.target_id}</p>}
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </div>
                          </div>
                        )}
                      </SheetContent>
                    </Sheet>
                    <Button variant="outline" size="sm" onClick={() => resolveAlert(alert.id)}>
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Alert Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alertRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getRuleDisplayName(rule.rule_name)}</span>
                    <Badge variant={getSeverityColor(rule.severity)}>
                      {rule.severity}
                    </Badge>
                    {rule.is_enabled ? (
                      <Badge variant="default">Enabled</Badge>
                    ) : (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{rule.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Threshold: {rule.threshold_count} events in {rule.time_window_minutes} minutes
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleRule(rule.id, !rule.is_enabled)}
                >
                  {rule.is_enabled ? 'Disable' : 'Enable'}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resolved Alerts */}
      {resolvedAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Resolved Alerts ({resolvedAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {resolvedAlerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg opacity-60">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{alert.title}</span>
                        <Badge variant="secondary">{alert.severity}</Badge>
                        <Badge variant="outline">Resolved</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Resolved: {alert.resolved_at ? new Date(alert.resolved_at).toLocaleString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {resolvedAlerts.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  And {resolvedAlerts.length - 5} more resolved alerts...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}