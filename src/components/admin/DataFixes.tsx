import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { DestructiveActionDialog } from '@/components/admin/DestructiveActionDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Database, 
  AlertTriangle,
  Shield,
  Users,
  CreditCard,
  RefreshCw,
  Settings
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DataFix {
  id: string;
  name: string;
  description: string;
  danger_level: 'low' | 'medium' | 'high' | 'critical';
  confirmation_text: string;
  icon: any;
  estimated_time: string;
  affected_tables: string[];
}

export function DataFixes() {
  const { organization, isOwner } = useUserOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedFix, setSelectedFix] = useState<DataFix | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const dataFixes: DataFix[] = [
    {
      id: 'rebuild_seat_counts',
      name: 'Rebuild Seat Counts',
      description: 'Recalculate and fix seat counts across all organizations by counting active members.',
      danger_level: 'medium',
      confirmation_text: 'REBUILD SEAT COUNTS',
      icon: Users,
      estimated_time: '2-5 minutes',
      affected_tables: ['organizations', 'organization_members', 'org_stripe_subscriptions']
    },
    {
      id: 'resync_stripe_metadata',
      name: 'Resync Stripe Metadata',
      description: 'Synchronize organization metadata with Stripe customer records and subscription data.',
      danger_level: 'high',
      confirmation_text: 'RESYNC STRIPE METADATA',
      icon: CreditCard,
      estimated_time: '5-10 minutes',
      affected_tables: ['organizations', 'org_stripe_subscriptions']
    },
    {
      id: 'fix_orphaned_members',
      name: 'Fix Orphaned Members',
      description: 'Remove organization members that reference non-existent organizations or users.',
      danger_level: 'medium',
      confirmation_text: 'FIX ORPHANED MEMBERS',
      icon: Users,
      estimated_time: '1-3 minutes',
      affected_tables: ['organization_members']
    },
    {
      id: 'normalize_audit_logs',
      name: 'Normalize Audit Logs',
      description: 'Fix malformed audit log entries and normalize action/target_type values.',
      danger_level: 'low',
      confirmation_text: 'NORMALIZE AUDIT LOGS',
      icon: Database,
      estimated_time: '3-8 minutes',
      affected_tables: ['audit_log', 'activity_logs']
    },
    {
      id: 'reset_trial_periods',
      name: 'Reset Trial Periods',
      description: 'DANGEROUS: Reset trial periods for all organizations. This affects billing.',
      danger_level: 'critical',
      confirmation_text: 'RESET ALL TRIAL PERIODS',
      icon: RefreshCw,
      estimated_time: '1-2 minutes',
      affected_tables: ['organizations', 'org_stripe_subscriptions']
    }
  ];

  const isDevelopment = process.env.NODE_ENV === 'development';
  const hasAccess = isOwner && isDevelopment; // Only in development for safety

  const getDangerColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const executeDataFix = async (reason: string) => {
    if (!hasAccess || !selectedFix) return;

    setLoading(selectedFix.id);
    try {
      // This would call a secure edge function to perform the data fix
      const { data, error } = await supabase.functions.invoke('admin-data-fixes', {
        body: {
          fix_id: selectedFix.id,
          reason: reason,
          organization_id: organization?.id
        }
      });

      if (error) throw error;

      toast({
        title: 'Data Fix Completed',
        description: `${selectedFix.name} has been successfully executed`,
      });

    } catch (err) {
      console.error('Data fix error:', err);
      
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Data fix failed',
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  const handleFixClick = (fix: DataFix) => {
    setSelectedFix(fix);
    setDialogOpen(true);
  };

  if (!hasAccess) {
    return (
      <Alert variant="destructive">
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Access denied. Data fixes are only available to superadmins in development environments.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Data Fixes (Dangerous Operations)
          </CardTitle>
          <CardDescription>
            Critical system operations that can modify data across multiple organizations.
            All operations require typed confirmation and are fully audited.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> These operations can permanently modify system data. 
              Always backup your database before running any data fixes. 
              All operations are logged and monitored.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            {dataFixes.map((fix) => {
              const IconComponent = fix.icon;
              const isRunning = loading === fix.id;
              
              return (
                <div key={fix.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <IconComponent className="h-5 w-5 mt-1" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{fix.name}</span>
                          <Badge className={getDangerColor(fix.danger_level)}>
                            {fix.danger_level} risk
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {fix.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Estimated time: {fix.estimated_time}</span>
                          <span>Tables: {fix.affected_tables.join(', ')}</span>
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant={fix.danger_level === 'critical' ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => handleFixClick(fix)}
                      disabled={!!loading}
                    >
                      {isRunning ? 'Running...' : 'Execute'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedFix && (
            <DestructiveActionDialog
              isOpen={dialogOpen}
              onOpenChange={setDialogOpen}
              title={`Execute ${selectedFix.name}`}
              description={selectedFix.description}
              actionName={selectedFix.id}
              targetType="system"
              targetId="data_fix"
              confirmationText={selectedFix.confirmation_text}
              dangerLevel={selectedFix.danger_level}
              onConfirm={executeDataFix}
              affectedTables={selectedFix.affected_tables}
              estimatedTime={selectedFix.estimated_time}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}