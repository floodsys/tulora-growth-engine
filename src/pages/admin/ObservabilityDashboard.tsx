import { useState, useEffect } from 'react';
import { LiveCallsMonitor } from '@/components/admin/LiveCallsMonitor';
import { WebhookDashboard } from '@/components/admin/WebhookDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Webhook,
  PhoneCall,
  AlertTriangle,
  TrendingUp,
  Server,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ObservabilityMetrics {
  generated_at: string;
  retell_webhooks: {
    last_1h: { total: number; by_type: Record<string, number> };
    last_24h: { total: number; by_type: Record<string, number> };
  };
  stripe_webhooks: {
    last_1h: { total: number; by_type: Record<string, number> };
    last_24h: { total: number; by_type: Record<string, number> };
  };
  failures: {
    last_1h: number;
    last_24h: number;
    recent_errors: Array<{
      id: string;
      action: string;
      error_code: string | null;
      target_type: string;
      created_at: string;
    }>;
  };
  latency: {
    call_p50_ms: number | null;
    call_p95_ms: number | null;
    sample_size: number;
  };
  calls: {
    active: number;
    total_24h: number;
    failed_24h: number;
  };
}

interface SystemHealth {
  totalCalls: number;
  activeCalls: number;
  webhookSuccessRate: number;
  avgResponseTime: number | null;
  errorRate: number;
  failuresLast24h: number;
  p50Latency: number | null;
  p95Latency: number | null;
}

export const ObservabilityDashboard = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState<ObservabilityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchObservabilityMetrics = async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'admin-observability-metrics',
        { method: 'GET' }
      );

      if (fnError) {
        console.error('Error fetching observability metrics:', fnError);
        setError(fnError.message || 'Failed to fetch metrics');
        return;
      }

      if (!data) {
        setError('No data returned');
        return;
      }

      const m = data as ObservabilityMetrics;
      setMetrics(m);

      // Derive system health from real metrics
      const totalWebhooks24h = m.retell_webhooks.last_24h.total + m.stripe_webhooks.last_24h.total;
      const totalFailures24h = m.failures.last_24h;
      const webhookSuccessRate = totalWebhooks24h > 0
        ? ((totalWebhooks24h - totalFailures24h) / totalWebhooks24h) * 100
        : 100;
      const errorRate = m.calls.total_24h > 0
        ? (m.calls.failed_24h / m.calls.total_24h) * 100
        : 0;

      setSystemHealth({
        totalCalls: m.calls.total_24h,
        activeCalls: m.calls.active,
        webhookSuccessRate: Math.max(0, Math.min(100, webhookSuccessRate)),
        avgResponseTime: m.latency.call_p50_ms,
        errorRate,
        failuresLast24h: totalFailures24h,
        p50Latency: m.latency.call_p50_ms,
        p95Latency: m.latency.call_p95_ms,
      });
      setError(null);
    } catch (err) {
      console.error('Error fetching observability metrics:', err);
      setError('Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObservabilityMetrics();
    const interval = setInterval(fetchObservabilityMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getHealthStatus = (): { status: string; color: string; icon: React.ReactNode } => {
    if (!systemHealth) return { status: 'Unknown', color: 'gray', icon: <Server className="h-4 w-4" /> };

    if (systemHealth.webhookSuccessRate >= 95 && systemHealth.errorRate < 5) {
      return {
        status: 'Healthy',
        color: 'green',
        icon: <TrendingUp className="h-4 w-4" />
      };
    } else if (systemHealth.webhookSuccessRate >= 90 && systemHealth.errorRate < 10) {
      return {
        status: 'Warning',
        color: 'yellow',
        icon: <AlertTriangle className="h-4 w-4" />
      };
    } else {
      return {
        status: 'Critical',
        color: 'red',
        icon: <AlertTriangle className="h-4 w-4" />
      };
    }
  };

  const healthStatus = getHealthStatus();

  const formatLatency = (ms: number | null): string => {
    if (ms === null) return 'No data';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            Observability & Live Ops
          </h1>
          <p className="text-muted-foreground">
            Real-time monitoring, alerting, and system health dashboard
          </p>
        </div>
        <Badge
          variant="secondary"
          className={`bg-${healthStatus.color}-50 text-${healthStatus.color}-700 border-${healthStatus.color}-200`}
        >
          <div className="flex items-center gap-1">
            {healthStatus.icon}
            System {healthStatus.status}
          </div>
        </Badge>
      </div>

      {/* Error Banner */}
      {error && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-3">
            <p className="text-sm text-amber-800">
              ⚠ Unable to load live metrics: {error}. Showing last known state.
            </p>
          </CardContent>
        </Card>
      )}

      {/* System Health Overview */}
      {systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <PhoneCall className="h-4 w-4" />
                Active Calls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemHealth.activeCalls}</div>
              <div className="text-xs text-muted-foreground">
                {systemHealth.totalCalls} total today
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                Webhook Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {systemHealth.webhookSuccessRate.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">Last 24 hours</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                P50 Latency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatLatency(systemHealth.p50Latency)}</div>
              <div className="text-xs text-muted-foreground">
                P95: {formatLatency(systemHealth.p95Latency)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Error Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {systemHealth.errorRate.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">
                {systemHealth.failuresLast24h} failures (24h)
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Server className="h-4 w-4" />
                Webhooks (1h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics ? metrics.retell_webhooks.last_1h.total + metrics.stripe_webhooks.last_1h.total : 0}
              </div>
              <div className="text-xs text-muted-foreground">Retell + Stripe</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Health Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold text-${healthStatus.color}-600`}>
                {healthStatus.status}
              </div>
              <div className="text-xs text-muted-foreground">Overall system</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading state */}
      {loading && !systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Errors */}
      {metrics && metrics.failures.recent_errors.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              Recent Errors ({metrics.failures.recent_errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.failures.recent_errors.slice(0, 5).map((err) => (
                <div key={err.id} className="flex items-center justify-between text-sm border-b pb-1">
                  <div>
                    <span className="font-mono text-red-600">{err.action}</span>
                    <span className="text-muted-foreground ml-2">({err.target_type})</span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {err.error_code && <Badge variant="outline" className="mr-2 text-xs">{err.error_code}</Badge>}
                    {new Date(err.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="live-calls" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="live-calls" className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4" />
            Live Calls Monitor
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Webhook Dashboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live-calls">
          <LiveCallsMonitor />
        </TabsContent>

        <TabsContent value="webhooks">
          <WebhookDashboard metrics={metrics} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
