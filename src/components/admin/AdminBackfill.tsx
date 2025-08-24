import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  Database, 
  PlayCircle, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Building2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BackfillResult {
  success: boolean;
  trace_id: string;
  total_organizations: number;
  processed_organizations: number;
  events_planned: number;
  events_created: number;
  events_skipped: number;
  organization_summary: Array<{
    organization_id: string;
    organization_name: string;
    events_planned: number;
    events_created: number;
    events_skipped: number;
  }>;
  error?: string;
}

export function AdminBackfill() {
  const { organization, isOwner } = useUserOrganization();
  const { toast } = useToast();
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<BackfillResult | null>(null);
  const [availableOrgs, setAvailableOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  // Environment check - only allow in dev/staging
  const isDevelopment = process.env.NODE_ENV === 'development';
  const hasAccess = isOwner && isDevelopment;

  const loadOrganizations = async () => {
    if (!hasAccess) return;
    
    setLoadingOrgs(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setAvailableOrgs(data || []);
    } catch (err) {
      console.error('Error loading organizations:', err);
      toast({
        title: 'Error',
        description: 'Failed to load organizations',
        variant: 'destructive'
      });
    } finally {
      setLoadingOrgs(false);
    }
  };

  const runBackfill = async (dryRun: boolean) => {
    if (!hasAccess || selectedOrgs.length === 0) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('backfill_audit_logs', {
        p_org_ids: selectedOrgs,
        p_dry_run: dryRun,
        p_batch_size: 200
      });

      if (error) throw error;

      const result = data as unknown as BackfillResult;
      setLastResult(result);
      
      toast({
        title: dryRun ? 'Dry Run Complete' : 'Backfill Complete',
        description: `Processed ${result.processed_organizations} organizations. ${dryRun ? 'Events planned' : 'Events created'}: ${dryRun ? result.events_planned : result.events_created}`,
      });

      // Log the admin action
      if (!dryRun) {
        await supabase.rpc('insert_audit_log', {
          p_org_id: organization?.id,
          p_action: 'admin.backfill_executed',
          p_target_type: 'system',
          p_actor_user_id: organization?.owner_user_id,
          p_actor_role_snapshot: 'admin',
          p_status: 'success',
          p_channel: 'internal',
        p_metadata: {
          trace_id: result.trace_id,
          organizations_processed: result.processed_organizations,
          events_created: result.events_created,
          admin_tool: 'global_backfill'
        }
        });
      }
    } catch (err) {
      console.error('Backfill error:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Backfill failed',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!hasAccess) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Access denied. This utility is only available to superadmins in development environments.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Global Activity Backfill
          </CardTitle>
          <CardDescription>
            Backfill missing audit log entries across multiple organizations.
            Always run dry-run first to preview changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Organizations</label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadOrganizations}
                  disabled={loadingOrgs}
                >
                  {loadingOrgs ? 'Loading...' : 'Load Organizations'}
                </Button>
                {availableOrgs.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedOrgs(availableOrgs.map(org => org.id))}
                  >
                    Select All ({availableOrgs.length})
                  </Button>
                )}
              </div>
            </div>

            {availableOrgs.length > 0 && (
              <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                <div className="grid grid-cols-1 gap-2">
                  {availableOrgs.map((org) => (
                    <label key={org.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedOrgs.includes(org.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrgs([...selectedOrgs, org.id]);
                          } else {
                            setSelectedOrgs(selectedOrgs.filter(id => id !== org.id));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{org.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {org.id.slice(0, 8)}
                      </Badge>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => runBackfill(true)}
                disabled={loading || selectedOrgs.length === 0}
                variant="outline"
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Dry Run Preview
              </Button>
              <Button
                onClick={() => runBackfill(false)}
                disabled={loading || selectedOrgs.length === 0 || !lastResult?.success}
                variant="default"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Execute Backfill
              </Button>
            </div>

            {selectedOrgs.length > 0 && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Selected {selectedOrgs.length} organization{selectedOrgs.length !== 1 ? 's' : ''} for backfill.
                  Always run dry-run first to preview the number of events that will be created.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle>Backfill Results</CardTitle>
            <CardDescription>
              Trace ID: {lastResult.trace_id}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{lastResult.total_organizations}</div>
                <div className="text-sm text-muted-foreground">Total Orgs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{lastResult.processed_organizations}</div>
                <div className="text-sm text-muted-foreground">Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{lastResult.events_planned || lastResult.events_created}</div>
                <div className="text-sm text-muted-foreground">Events {lastResult.events_created ? 'Created' : 'Planned'}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{lastResult.events_skipped}</div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
            </div>

            {lastResult.organization_summary && lastResult.organization_summary.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <h4 className="font-medium">Organization Summary</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {lastResult.organization_summary.map((org) => (
                    <div key={org.organization_id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span className="font-medium">{org.organization_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {org.organization_id.slice(0, 8)}
                        </Badge>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span className="text-purple-600">
                          {org.events_planned || org.events_created} events
                        </span>
                        <span className="text-orange-600">
                          {org.events_skipped} skipped
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}