import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  RefreshCw, 
  Webhook, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { formatDistance } from 'date-fns';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface WebhookEvent {
  id: string;
  event_type: string;
  status: 'success' | 'failed' | 'pending';
  attempts: number;
  last_attempt_at: string;
  next_retry_at?: string;
  response_code?: number;
  error_message?: string;
  created_at: string;
  organization_id: string;
}

interface WebhookStats {
  total_events: number;
  success_rate: number;
  failed_count: number;
  avg_response_time: number;
  spike_detected: boolean;
}

export const WebhookDashboard = () => {
  const { organization } = useUserOrganization();
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchWebhookData = async () => {
    if (!organization?.id) return;

    try {
      setLoading(true);

      // Fetch recent webhook events
      const { data: events, error: eventsError } = await supabase
        .from('audit_log')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('target_type', 'webhook')
        .order('created_at', { ascending: false })
        .limit(100);

      if (eventsError) throw eventsError;

      // Transform audit log entries to webhook events
      const formattedEvents: WebhookEvent[] = events?.map(event => ({
        id: event.id,
        event_type: event.action,
        status: event.status === 'success' ? 'success' : 'failed',
        attempts: (event.metadata as any)?.attempts || 1,
        last_attempt_at: event.created_at,
        response_code: (event.metadata as any)?.response_code,
        error_message: event.error_code || (event.metadata as any)?.error,
        created_at: event.created_at,
        organization_id: event.organization_id
      })) || [];

      setWebhookEvents(formattedEvents);

      // Calculate stats
      const totalEvents = formattedEvents.length;
      const successCount = formattedEvents.filter(e => e.status === 'success').length;
      const failedCount = formattedEvents.filter(e => e.status === 'failed').length;
      const successRate = totalEvents > 0 ? (successCount / totalEvents) * 100 : 0;

      // Check for spikes (more than 10% failure rate in last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentEvents = formattedEvents.filter(e => new Date(e.created_at) > oneHourAgo);
      const recentFailureRate = recentEvents.length > 0 ? 
        (recentEvents.filter(e => e.status === 'failed').length / recentEvents.length) * 100 : 0;
      const spikeDetected = recentFailureRate > 10 && recentEvents.length > 5;

      const webhookStats: WebhookStats = {
        total_events: totalEvents,
        success_rate: successRate,
        failed_count: failedCount,
        avg_response_time: 150, // Mock for now
        spike_detected: spikeDetected
      };

      setStats(webhookStats);

      // Create chart data (hourly buckets)
      const hourlyData = new Array(24).fill(0).map((_, i) => {
        const hour = new Date(Date.now() - (23 - i) * 60 * 60 * 1000);
        const hourEvents = formattedEvents.filter(e => {
          const eventHour = new Date(e.created_at);
          return eventHour.getHours() === hour.getHours() && 
                 eventHour.getDate() === hour.getDate();
        });

        return {
          hour: hour.getHours(),
          success: hourEvents.filter(e => e.status === 'success').length,
          failed: hourEvents.filter(e => e.status === 'failed').length,
          total: hourEvents.length
        };
      });

      setChartData(hourlyData);
      setLastUpdate(new Date());

      // Alert on spikes
      if (spikeDetected) {
        toast.error(
          `Webhook failure spike detected! ${recentFailureRate.toFixed(1)}% failure rate in the last hour`,
          { duration: 10000 }
        );
      }

    } catch (error) {
      console.error('Error fetching webhook data:', error);
      toast.error('Failed to fetch webhook data');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchWebhookData, 30000);
    return () => clearInterval(interval);
  }, [organization?.id]);

  // Initial fetch
  useEffect(() => {
    fetchWebhookData();
  }, [organization?.id, timeRange]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      case 'pending':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Webhook className="h-6 w-6" />
            Webhook Dashboard
          </h2>
          <p className="text-muted-foreground">
            Monitor webhook delivery success rates and failures
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchWebhookData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_events}</div>
              <div className="text-xs text-muted-foreground">
                Last {timeRange}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">
                  {stats.success_rate.toFixed(1)}%
                </div>
                {stats.success_rate >= 95 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {stats.total_events - stats.failed_count} successful
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Failed Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.failed_count}
              </div>
              <div className="text-xs text-muted-foreground">
                Require attention
              </div>
            </CardContent>
          </Card>

          <Card className={stats.spike_detected ? 'border-red-500 bg-red-50' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Alert Status
                {stats.spike_detected && <AlertTriangle className="h-4 w-4 text-red-500" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.spike_detected ? 'text-red-600' : 'text-green-600'}`}>
                {stats.spike_detected ? 'SPIKE' : 'NORMAL'}
              </div>
              <div className="text-xs text-muted-foreground">
                {stats.spike_detected ? 'High failure rate detected' : 'All systems operational'}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Events Over Time</CardTitle>
          <CardDescription>Success vs failure rates by hour</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [value, name === 'success' ? 'Success' : 'Failed']}
                  labelFormatter={(hour) => `Hour: ${hour}:00`}
                />
                <Bar dataKey="success" stackId="a" fill="#10b981" />
                <Bar dataKey="failed" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Webhook Events</CardTitle>
          <CardDescription>
            Latest webhook deliveries and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {webhookEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No webhook events found</p>
              <p className="text-sm">Webhook events will appear here once configured</p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhookEvents.slice(0, 20).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${getStatusColor(event.status)}`}>
                      {getStatusIcon(event.status)}
                    </div>
                    <div>
                      <div className="font-medium">{event.event_type}</div>
                      <div className="text-sm text-muted-foreground">
                        {event.error_message && `Error: ${event.error_message}`}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <Badge className={getStatusColor(event.status)}>
                        {event.status}
                      </Badge>
                      {event.response_code && (
                        <div className="text-sm text-muted-foreground mt-1">
                          HTTP {event.response_code}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDistance(new Date(event.created_at), new Date(), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};