import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { supabase } from "@/integrations/supabase/client"
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { useOrganizationRole } from "@/hooks/useOrganizationRole"
import { getEnvironmentConfig } from "@/lib/environment"
import { toast } from "sonner"
import { 
  PlayCircle, 
  CheckCircle, 
  AlertTriangle, 
  Eye, 
  Database,
  Shield,
  Clock,
  Users,
  Settings,
  CreditCard,
  Download,
  Filter,
  BarChart3
} from "lucide-react"

interface BackfillResult {
  success: boolean;
  dry_run: boolean;
  trace_id?: string;
  total_organizations?: number;
  processed_organizations?: number;
  events_planned?: number;
  events_created?: number;
  events_skipped?: number;
  events_preview?: any[];
  organization_summary?: any[];
  error?: string;
  error_code?: string;
}

interface OrganizationOption {
  id: string;
  name: string;
}

export function AuditLogBackfill() {
  const { organization } = useUserOrganization();
  const { isAdmin } = useOrganizationRole(organization?.id);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<BackfillResult | null>(null);
  const [scope, setScope] = useState<'current' | 'all' | 'custom'>('current');
  const [customOrgIds, setCustomOrgIds] = useState('');
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [progress, setProgress] = useState(0);
  const config = getEnvironmentConfig();
  
  // Check if backfill is enabled (simulated env flag check)
  const backfillEnabled = config.testLevel !== 'off';
  
  if (!organization) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Audit Log Backfill
          </CardTitle>
          <CardDescription>
            No organization selected
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Audit Log Backfill
          </CardTitle>
          <CardDescription>
            Only organization owners can perform audit log backfill operations
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!backfillEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Audit Log Backfill
          </CardTitle>
          <CardDescription>
            Generate historical audit events for existing organization data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Backfill is currently disabled. Set VITE_BACKFILL_ENABLED=true or enable testing mode to use this feature.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const runBackfill = async (dryRun: boolean) => {
    setIsLoading(true);
    setProgress(0);
    
    try {
      let rpcParams: any = {
        p_dry_run: dryRun,
        p_batch_size: 200
      };
      
      // Determine scope parameters
      if (scope === 'current' && organization?.id) {
        rpcParams.p_org_id = organization.id;
      } else if (scope === 'custom' && customOrgIds.trim()) {
        const ids = customOrgIds.split(',').map(id => id.trim()).filter(Boolean);
        rpcParams.p_org_ids = ids;
      }
      // For 'all', both p_org_id and p_org_ids remain undefined to process all accessible orgs

      const { data, error } = await supabase.rpc('backfill_audit_logs' as any, rpcParams);

      if (error) {
        throw error;
      }

      setLastResult(data as unknown as BackfillResult);
      setProgress(100);
      
      const result = data as any;
      if (dryRun) {
        toast.success(
          `Dry run complete: ${result.events_planned || 0} events planned, ${result.events_skipped || 0} already exist`
        );
      } else {
        toast.success(
          `Backfill complete: ${result.events_created || 0} events created, ${result.events_skipped || 0} skipped`
        );
      }
    } catch (error: any) {
      console.error('Backfill error:', error);
      toast.error(`Backfill failed: ${error.message}`);
      setLastResult({
        success: false,
        dry_run: dryRun,
        error: error.message
      });
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  const exportResults = () => {
    if (!lastResult || !lastResult.organization_summary) return;
    
    const csvData = [
      ['Organization ID', 'Organization Name', 'Events Planned', 'Events Created', 'Events Skipped'],
      ...lastResult.organization_summary.map((org: any) => [
        org.organization_id,
        org.organization_name,
        org.events_planned,
        org.events_created,
        org.events_skipped
      ])
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-backfill-${lastResult.trace_id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getEventIcon = (action: string) => {
    if (action.includes('org.')) return <Settings className="h-4 w-4" />;
    if (action.includes('member.')) return <Users className="h-4 w-4" />;
    if (action.includes('subscription.')) return <CreditCard className="h-4 w-4" />;
    if (action.includes('agent.')) return <Database className="h-4 w-4" />;
    if (action.includes('settings.')) return <Settings className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Audit Log Backfill
        </CardTitle>
        <CardDescription>
          Generate historical audit events for existing organization data. This is safe and idempotent.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Safety Features:</strong> Backfill operations are idempotent (won't create duplicates), 
            use audit channel only, and never trigger emails or external webhooks.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Scope & Filters
          </h4>
          
          <div className="space-y-3">
            <div>
              <Label htmlFor="scope">Organization Scope</Label>
              <Select value={scope} onValueChange={(value: any) => setScope(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current Organization Only</SelectItem>
                  <SelectItem value="all">All Accessible Organizations</SelectItem>
                  <SelectItem value="custom">Custom Organization IDs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {scope === 'custom' && (
              <div>
                <Label htmlFor="orgIds">Organization IDs (comma-separated)</Label>
                <Input
                  id="orgIds"
                  placeholder="uuid1, uuid2, uuid3..."
                  value={customOrgIds}
                  onChange={(e) => setCustomOrgIds(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium">Events that will be generated:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>Organization created</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Member additions & roles</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span>Subscription snapshots</span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span>Agent creations</span>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => runBackfill(true)}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              {isLoading ? "Running..." : "Dry Run Preview"}
            </Button>
            
            <Button
              onClick={() => runBackfill(false)}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <PlayCircle className="h-4 w-4" />
              {isLoading ? "Executing..." : "Execute Backfill"}
            </Button>
          </div>
          
          {isLoading && progress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </div>

        {lastResult && (
          <div className="space-y-4">
            <Separator />
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {lastResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                )}
                <h4 className="font-medium">
                  {lastResult.dry_run ? "Dry Run" : "Execution"} Result
                </h4>
                {lastResult.dry_run && (
                  <Badge variant="outline">Preview Only</Badge>
                )}
              </div>

              {lastResult.success ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Organizations:</span>
                      <div className="font-medium">{lastResult.processed_organizations || 0} / {lastResult.total_organizations || 0}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Events Planned:</span>
                      <div className="font-medium">{lastResult.events_planned || 0}</div>
                    </div>
                    {!lastResult.dry_run && (
                      <div>
                        <span className="text-muted-foreground">Events Created:</span>
                        <div className="font-medium text-green-600">{lastResult.events_created || 0}</div>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Events Skipped:</span>
                      <div className="font-medium text-orange-600">{lastResult.events_skipped || 0}</div>
                    </div>
                  </div>

                  {lastResult.trace_id && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Trace ID:</span>
                        <code className="ml-2 px-1 py-0.5 bg-muted rounded text-xs">
                          {lastResult.trace_id}
                        </code>
                      </div>
                      {lastResult.organization_summary && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={exportResults}
                          className="flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Export CSV
                        </Button>
                      )}
                    </div>
                  )}

                  {lastResult.organization_summary && lastResult.organization_summary.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Organization Summary:
                      </h5>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {lastResult.organization_summary.map((org: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded text-sm">
                            <div className="flex flex-col">
                              <span className="font-medium">{org.organization_name}</span>
                              <code className="text-xs text-muted-foreground">{org.organization_id}</code>
                            </div>
                            <div className="flex gap-4 text-xs">
                              <span className="text-blue-600">Planned: {org.events_planned}</span>
                              {!lastResult.dry_run && (
                                <span className="text-green-600">Created: {org.events_created}</span>
                              )}
                              <span className="text-orange-600">Skipped: {org.events_skipped}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {lastResult.events_preview && lastResult.events_preview.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium">Event Preview (Sample):</h5>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {lastResult.events_preview.slice(0, 10).map((event, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                            {getEventIcon(event.action)}
                            <span className="font-medium">{event.action}</span>
                            <Badge variant="outline" className="text-xs">
                              {event.target_type}
                            </Badge>
                            <span className="text-muted-foreground text-xs ml-auto">
                              {new Date(event.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                        {lastResult.events_preview.length > 10 && (
                          <div className="text-xs text-muted-foreground text-center py-1">
                            ... and {lastResult.events_preview.length - 10} more events
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Error:</strong> {lastResult.error}
                    {lastResult.error_code && (
                      <div className="text-xs mt-1">Code: {lastResult.error_code}</div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}