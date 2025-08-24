import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Activity, Info, CheckCircle2, XCircle, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
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
  events_preview?: Array<{
    action: string;
    target_type: string;
    target_id: string;
    created_at: string;
    organization_id: string;
  }>;
  organization_summary?: Array<{
    organization_id: string;
    organization_name: string;
    events_planned: number;
    events_created: number;
    events_skipped: number;
  }>;
  error?: string;
}

interface EventTypeSummary {
  action: string;
  target_type: string;
  would_create: number;
  would_skip: number;
  preview_events: Array<{
    action: string;
    target_type: string;
    target_id: string;
    created_at: string;
  }>;
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
  const [confirmText, setConfirmText] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
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
    if (mode === 'execute' && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    if (mode === 'execute' && confirmText !== 'BACKFILL') {
      toast({
        title: 'Invalid confirmation',
        description: 'Please type "BACKFILL" to confirm',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setResult(null);
    setProgress(0);

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
        setProgress(100);
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
      setShowConfirmation(false);
      setConfirmText('');
    }
  };

  const generateEventTypeSummary = (): EventTypeSummary[] => {
    if (!result?.events_preview) return [];

    const summaryMap = new Map<string, EventTypeSummary>();

    result.events_preview.forEach(event => {
      const key = `${event.action}-${event.target_type}`;
      
      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          action: event.action,
          target_type: event.target_type,
          would_create: 0,
          would_skip: 0,
          preview_events: []
        });
      }

      const summary = summaryMap.get(key)!;
      summary.would_create++;
      
      if (summary.preview_events.length < 25) {
        summary.preview_events.push({
          action: event.action,
          target_type: event.target_type,
          target_id: event.target_id,
          created_at: event.created_at
        });
      }
    });

    return Array.from(summaryMap.values());
  };

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expandedTypes);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedTypes(newExpanded);
  };

  const handleClose = () => {
    setResult(null);
    setMode('dry-run');
    setConfirmText('');
    setShowConfirmation(false);
    setProgress(0);
    setExpandedTypes(new Set());
    onOpenChange(false);
  };

  const eventTypeSummary = generateEventTypeSummary();
  const hasSuccessfulDryRun = result?.success && result?.dry_run;

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
                <div className="space-y-4">
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
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Events planned</div>
                          <div className="text-lg font-semibold">{result.events_planned}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">
                            {result.dry_run ? 'Would create' : 'Events created'}
                          </div>
                          <div className="text-lg font-semibold text-green-600">{result.events_created}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">
                            {result.dry_run ? 'Would skip' : 'Events skipped'}
                          </div>
                          <div className="text-lg font-semibold text-muted-foreground">{result.events_skipped}</div>
                        </div>
                      </div>

                      {result.dry_run && (
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Dry-run writes nothing.</strong> Emails/webhooks are disabled. This is a preview only.
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Event Type Summary for Dry-run */}
                      {result.dry_run && eventTypeSummary.length > 0 && (
                        <div className="space-y-3">
                          <Label className="font-medium">Event Summary by Type</Label>
                          <div className="space-y-2">
                            {eventTypeSummary.map((summary) => {
                              const key = `${summary.action}-${summary.target_type}`;
                              const isExpanded = expandedTypes.has(key);
                              
                              return (
                                <Card key={key}>
                                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(key)}>
                                    <CollapsibleTrigger asChild>
                                      <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <Badge variant="outline">{summary.action}</Badge>
                                            <Badge variant="secondary">{summary.target_type}</Badge>
                                          </div>
                                          <div className="flex items-center gap-3 text-sm">
                                            <span className="text-green-600 font-medium">
                                              +{summary.would_create} create
                                            </span>
                                            <span className="text-muted-foreground">
                                              {summary.would_skip} skip
                                            </span>
                                            {isExpanded ? (
                                              <ChevronDown className="h-4 w-4" />
                                            ) : (
                                              <ChevronRight className="h-4 w-4" />
                                            )}
                                          </div>
                                        </div>
                                      </CardHeader>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                      <CardContent className="pt-0">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Target ID</TableHead>
                                              <TableHead>Created At</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {summary.preview_events.slice(0, 25).map((event, idx) => (
                                              <TableRow key={idx}>
                                                <TableCell className="font-mono text-xs">
                                                  {event.target_id || 'N/A'}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                  {new Date(event.created_at).toLocaleString()}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                        {summary.preview_events.length > 25 && (
                                          <p className="text-xs text-muted-foreground mt-2">
                                            Showing first 25 of {summary.preview_events.length} events
                                          </p>
                                        )}
                                      </CardContent>
                                    </CollapsibleContent>
                                  </Collapsible>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Progress bar for execute mode */}
                      {mode === 'execute' && loading && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Processing events...</span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <Progress value={progress} className="w-full" />
                        </div>
                      )}
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

          {/* Execute Confirmation Modal */}
          {showConfirmation && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="space-y-3">
                <div className="text-yellow-800 font-medium">
                  You are about to execute the backfill for this organization. This will create {result?.events_planned || 0} audit events.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm" className="text-yellow-800">
                    Type <strong>BACKFILL</strong> to confirm:
                  </Label>
                  <Input
                    id="confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type BACKFILL to confirm"
                    className="bg-white"
                  />
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {showConfirmation ? 'Cancel' : 'Close'}
          </Button>
          {hasSuccessfulDryRun && mode === 'dry-run' && (
            <Button 
              onClick={() => setMode('execute')}
              disabled={loading}
            >
              Proceed to Execute
            </Button>
          )}
          {mode === 'dry-run' && (
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
                'Run Dry-run'
              )}
            </Button>
          )}
          {mode === 'execute' && (
            <Button 
              onClick={handleBackfill} 
              disabled={loading || (showConfirmation && confirmText !== 'BACKFILL')}
              variant={showConfirmation ? 'destructive' : 'default'}
              className="min-w-[120px]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : showConfirmation ? (
                'Confirm Execute'
              ) : (
                'Execute Backfill'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}