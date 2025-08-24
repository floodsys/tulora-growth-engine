import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface ActivityLog {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  actor_user_id: string | null;
  actor_role_snapshot: string;
  status: string;
  channel: string;
  metadata: any;
  created_at: string;
}

interface ViewActivityDialogProps {
  organizationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewActivityDialog({ 
  organizationId, 
  open, 
  onOpenChange 
}: ViewActivityDialogProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [organizationName, setOrganizationName] = useState('');

  useEffect(() => {
    if (open && organizationId) {
      loadActivityLogs();
    }
  }, [open, organizationId]);

  const loadActivityLogs = async () => {
    if (!organizationId) return;

    try {
      setLoading(true);

      // Get organization name
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();

      if (orgData) {
        setOrganizationName(orgData.name);
      }

      // Get activity logs
      const { data: logsData, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setLogs(logsData || []);
    } catch (error) {
      console.error('Error loading activity logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load activity logs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    const actionColors: Record<string, string> = {
      'org.created': 'bg-green-100 text-green-800',
      'org.updated': 'bg-blue-100 text-blue-800',
      'org.deleted': 'bg-red-100 text-red-800',
      'member.invited': 'bg-purple-100 text-purple-800',
      'member.joined': 'bg-green-100 text-green-800',
      'member.removed': 'bg-red-100 text-red-800',
      'agent.created': 'bg-blue-100 text-blue-800',
      'billing.updated': 'bg-yellow-100 text-yellow-800'
    };

    return (
      <Badge className={actionColors[action] || 'bg-gray-100 text-gray-800'}>
        {action}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, 'default' | 'destructive' | 'secondary'> = {
      success: 'default',
      error: 'destructive',
      pending: 'secondary'
    };

    return <Badge variant={statusColors[status] || 'secondary'}>{status}</Badge>;
  };

  const formatLogDetails = (log: ActivityLog) => {
    const details = [];
    
    if (log.target_type && log.target_id) {
      details.push(`Target: ${log.target_type}:${log.target_id.slice(0, 8)}...`);
    }
    
    if (log.actor_role_snapshot) {
      details.push(`Role: ${log.actor_role_snapshot}`);
    }
    
    if (log.channel) {
      details.push(`Channel: ${log.channel}`);
    }

    return details.join(' • ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Activity Logs - {organizationName}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activity logs found for this organization
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log, index) => (
                <div key={log.id}>
                  <div className="flex items-start justify-between space-x-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center space-x-2">
                        {getActionBadge(log.action)}
                        {getStatusBadge(log.status)}
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        {formatLogDetails(log)}
                      </div>
                      
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            View metadata
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                  
                  {index < logs.length - 1 && <Separator className="my-4" />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}