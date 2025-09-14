import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Phone, PhoneCall, AlertTriangle } from 'lucide-react';
import { formatDistance } from 'date-fns';
import { toast } from 'sonner';

interface LiveCall {
  id: string;
  call_id: string;
  agent_name: string;
  status: 'ringing' | 'in_progress';
  started_at: string;
  phone_number?: string;
  duration_seconds?: number;
  organization_id: string;
}

export const LiveCallsMonitor = () => {
  const { organization } = useUserOrganization();
  const [liveCalls, setLiveCalls] = useState<LiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLiveCalls = async () => {
    if (!organization?.id) return;

    try {
      const { data, error } = await supabase
        .from('retell_calls')
        .select(`
          id,
          call_id,
          status,
          started_at,
          from_e164,
          duration_ms,
          organization_id,
          agent_id
        `)
        .eq('organization_id', organization.id)
        .in('status', ['ringing', 'in_progress'])
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedCalls = data?.map(call => ({
        id: call.id,
        call_id: call.call_id,
        agent_name: call.agent_id || 'Unknown Agent',
        status: call.status as 'ringing' | 'in_progress',
        started_at: call.started_at,
        phone_number: call.from_e164,
        duration_seconds: call.duration_ms ? Math.floor(call.duration_ms / 1000) : undefined,
        organization_id: call.organization_id
      })) || [];

      setLiveCalls(formattedCalls);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching live calls:', error);
      toast.error('Failed to fetch live calls');
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time subscriptions
  useEffect(() => {
    if (!organization?.id) return;

    const channel = supabase
      .channel('live-calls-monitor')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'retell_calls',
          filter: `organization_id=eq.${organization.id}`
        },
        (payload) => {
          console.log('Live call update:', payload);
          fetchLiveCalls(); // Refresh on any changes
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organization?.id]);

  // Auto-refresh every 5 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLiveCalls();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, organization?.id]);

  // Initial fetch
  useEffect(() => {
    fetchLiveCalls();
  }, [organization?.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ringing':
        return 'bg-yellow-500';
      case 'in_progress':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ringing':
        return <Phone className="h-4 w-4" />;
      case 'in_progress':
        return <PhoneCall className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const formatDuration = (startedAt: string) => {
    const start = new Date(startedAt);
    const now = new Date();
    const durationMs = now.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5" />
              Live Calls Monitor
            </CardTitle>
            <CardDescription>
              Real-time monitoring of active calls ({liveCalls.length} active)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
            >
              <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLiveCalls}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Last updated: {formatDistance(lastUpdate, new Date(), { addSuffix: true })}
        </div>
      </CardHeader>
      <CardContent>
        {liveCalls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <PhoneCall className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No active calls at the moment</p>
            <p className="text-sm">Calls in 'ringing' or 'in_progress' status will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {liveCalls.map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${getStatusColor(call.status)}`}>
                    {getStatusIcon(call.status)}
                  </div>
                  <div>
                    <div className="font-medium">{call.agent_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {call.phone_number || call.call_id}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <Badge 
                      variant="secondary" 
                      className={`capitalize ${getStatusColor(call.status)} text-white`}
                    >
                      {call.status.replace('_', ' ')}
                    </Badge>
                    <div className="text-sm text-muted-foreground mt-1">
                      {call.status === 'in_progress' ? 
                        formatDuration(call.started_at) : 
                        formatDistance(new Date(call.started_at), new Date(), { addSuffix: true })
                      }
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};