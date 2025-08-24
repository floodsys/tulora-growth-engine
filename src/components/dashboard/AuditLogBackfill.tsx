import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
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
  CreditCard
} from "lucide-react"

interface BackfillResult {
  success: boolean;
  organization_id: string;
  dry_run: boolean;
  trace_id?: string;
  events_planned?: number;
  events_created?: number;
  events_preview?: any[];
  error?: string;
  error_code?: string;
}

export function AuditLogBackfill() {
  const { organization } = useUserOrganization();
  const { isAdmin } = useOrganizationRole(organization?.id);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<BackfillResult | null>(null);
  const config = getEnvironmentConfig();
  
  // Check if backfill is enabled (simulated env flag check)
  const backfillEnabled = import.meta.env.VITE_BACKFILL_ENABLED === 'true' || config.testLevel !== 'off';
  
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
    if (!organization?.id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('backfill_audit_logs', {
        p_org_id: organization.id,
        p_dry_run: dryRun
      });

      if (error) {
        throw error;
      }

      setLastResult(data as unknown as BackfillResult);
      
      if (dryRun) {
        toast.success(`Dry run complete: ${(data as any).events_planned || 0} events would be created`);
      } else {
        toast.success(`Backfill complete: ${(data as any).events_created || 0} events created`);
      }
    } catch (error) {
      console.error('Backfill error:', error);
      toast.error(`Backfill failed: ${error.message}`);
      setLastResult({
        success: false,
        organization_id: organization.id,
        dry_run: dryRun,
        error: error.message
      });
    } finally {
      setIsLoading(false);
    }
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
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>Settings initialization</span>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => runBackfill(true)}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            {isLoading ? "Running..." : "Dry Run"}
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
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
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
                  </div>

                  {lastResult.trace_id && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Trace ID:</span>
                      <code className="ml-2 px-1 py-0.5 bg-muted rounded text-xs">
                        {lastResult.trace_id}
                      </code>
                    </div>
                  )}

                  {lastResult.events_preview && lastResult.events_preview.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium">Event Preview:</h5>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {lastResult.events_preview.map((event, index) => (
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