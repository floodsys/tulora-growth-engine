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
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { supabase } from '@/integrations/supabase/client';

interface SystemHealth {
  totalCalls: number;
  activeCalls: number;
  webhookSuccessRate: number;
  avgResponseTime: number;
  errorRate: number;
  uptime: string;
}

export const ObservabilityDashboard = () => {
  const { organization } = useUserOrganization();
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);

  const fetchSystemHealth = async () => {
    if (!organization?.id) return;

    try {
      // Fetch system health metrics
      const [callsData, webhookData] = await Promise.all([
        supabase
          .from('retell_calls')
          .select('status, created_at')
          .eq('organization_id', organization.id)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        
        supabase
          .from('audit_log')
          .select('status')
          .eq('organization_id', organization.id)
          .eq('target_type', 'webhook')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      ]);

      const totalCalls = callsData.data?.length || 0;
      const activeCalls = callsData.data?.filter(call => 
        ['ringing', 'in_progress'].includes(call.status)
      ).length || 0;

      const webhookEvents = webhookData.data || [];
      const webhookSuccessCount = webhookEvents.filter(event => 
        event.status === 'success'
      ).length;
      const webhookSuccessRate = webhookEvents.length > 0 ? 
        (webhookSuccessCount / webhookEvents.length) * 100 : 100;

      setSystemHealth({
        totalCalls,
        activeCalls,
        webhookSuccessRate,
        avgResponseTime: 145, // Mock data
        errorRate: ((totalCalls - activeCalls) / Math.max(totalCalls, 1)) * 100,
        uptime: '99.9%' // Mock data
      });

    } catch (error) {
      console.error('Error fetching system health:', error);
    }
  };

  useEffect(() => {
    fetchSystemHealth();
    const interval = setInterval(fetchSystemHealth, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [organization?.id]);

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
                Webhook Success
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
                Avg Response
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemHealth.avgResponseTime}ms</div>
              <div className="text-xs text-muted-foreground">API response time</div>
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
              <div className="text-xs text-muted-foreground">Last 24 hours</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Server className="h-4 w-4" />
                System Uptime
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemHealth.uptime}</div>
              <div className="text-xs text-muted-foreground">Last 30 days</div>
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
          <WebhookDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};