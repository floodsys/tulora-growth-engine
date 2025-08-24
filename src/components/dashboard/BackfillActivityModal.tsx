import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Activity, Info, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BackfillActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  onSuccess?: () => void;
}

interface EventType {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

interface BackfillResult {
  success: boolean;
  dry_run: boolean;
  events_planned: number;
  events_created: number;
  events_skipped: number;
  organization_summary?: Array<{
    organization_id: string;
    organization_name: string;
    events_planned: number;
    events_created: number;
    events_skipped: number;
  }>;
  error?: string;
}

export function BackfillActivityModal({ 
  open, 
  onOpenChange, 
  organizationId, 
  organizationName,
  onSuccess 
}: BackfillActivityModalProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'dry-run' | 'execute'>('dry-run');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);
  const [eventTypes] = useState<EventType[]>([
    {
      id: 'org_created',
      name: 'org.created',
      description: 'Organization creation event',
      enabled: true
    },
    {
      id: 'member_added',
      name: 'member.added',
      description: 'Member addition events',
      enabled: true
    },
    {
      id: 'member_role_set',
      name: 'member.role_set',
      description: 'Member role assignment snapshots (optional)',
      enabled: true
    },
    {
      id: 'subscription_synced',
      name: 'subscription.synced',
      description: 'Subscription sync events (if subscriptions exist)',
      enabled: true
    },
    {
      id: 'agent_seeded',
      name: 'agent.seeded/imported',
      description: 'Agent creation events (if agents exist)',
      enabled: true
    },
    {
      id: 'settings_initialized',
      name: 'settings.initialized',
      description: 'Settings initialization (presence flags only)',
      enabled: true
    }
  ]);

  const handleBackfill = async () => {
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.rpc('backfill_audit_logs' as any, {
        p_org_id: organizationId,
        p_dry_run: mode === 'dry-run',
        p_batch_size: 200
      });

      if (error) {
        throw error;
      }

      setResult(data as BackfillResult);

      if (data?.success) {
        toast({
          title: mode === 'dry-run' ? 'Dry-run completed' : 'Backfill completed',
          description: mode === 'dry-run' 
            ? `Found ${data.events_planned} events to backfill`
            : `Successfully created ${data.events_created} events, skipped ${data.events_skipped} existing`,
        });

        if (mode === 'execute' && onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error(data?.error || 'Unknown error occurred');
      }
    } catch (err) {
      console.error('Backfill error:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to backfill activity',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setMode('dry-run');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Backfill missing activity for this organization
          </DialogTitle>
          <DialogDescription>
            This fills in foundational events (e.g., org.created, member.added) so the Activity timeline isn't missing early history. 
            Dry-run first — no writes, no emails, no webhooks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This process is <strong>idempotent</strong> and <strong>safe</strong>. It only creates events that don't already exist and never sends notifications.
            </AlertDescription>
          </Alert>

          {/* Organization Info */}
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Organization</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-medium">{organizationName}</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">{organizationId}</code>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mode Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Mode</Label>
            <RadioGroup value={mode} onValueChange={(value) => setMode(value as 'dry-run' | 'execute')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dry-run" id="dry-run" />
                <Label htmlFor="dry-run" className="flex items-center gap-2">
                  Dry-run 
                  <Badge variant="outline">Preview only</Badge>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="execute" id="execute" />
                <Label htmlFor="execute" className="flex items-center gap-2">
                  Execute 
                  <Badge variant="secondary">Write events</Badge>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Event Types */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Event types (all pre-checked)</Label>
            <div className="space-y-2">
              {eventTypes.map((eventType) => (
                <div key={eventType.id} className="flex items-start space-x-3 p-3 bg-muted/30 rounded-lg">
                  <Checkbox 
                    id={eventType.id}
                    checked={eventType.enabled}
                    disabled
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label htmlFor={eventType.id} className="text-sm font-medium">
                      {eventType.name}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {eventType.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Results */}
          {result && (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <Label className="font-medium">
                      {result.success ? 'Success' : 'Error'}
                    </Label>
                  </div>
                  
                  {result.success ? (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Events planned</div>
                        <div className="text-lg font-semibold">{result.events_planned}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Events created</div>
                        <div className="text-lg font-semibold text-green-600">{result.events_created}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Events skipped</div>
                        <div className="text-lg font-semibold text-muted-foreground">{result.events_skipped}</div>
                      </div>
                    </div>
                  ) : (
                    <Alert variant="destructive">
                      <AlertDescription>{result.error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleBackfill} 
            disabled={loading}
            className="min-w-[120px]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              `Run ${mode === 'dry-run' ? 'Dry-run' : 'Execute'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}