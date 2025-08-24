import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Filter, 
  RefreshCw, 
  Download, 
  Eye, 
  ExternalLink,
  Calendar,
  User,
  Activity,
  Search,
  AlertTriangle,
  Database,
  TestTube,
  Shield,
  Clock,
  Link
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { getEnvironmentConfig } from '@/lib/environment';
import { toast } from '@/hooks/use-toast';

interface AdminLogEntry {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  actor_role_snapshot: string;
  action: string;
  target_type: string;
  target_id: string | null;
  status: string;
  error_code: string | null;
  channel: string;
  metadata: any;
  created_at: string;
  ip_hash?: string;
  user_agent?: string;
  request_id?: string;
}

interface LogFilters {
  action?: string;
  actor_user_id?: string;
  target_type?: string;
  status?: string;
  channel?: string;
  organization_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

const CHANNEL_CONFIGS = {
  audit: {
    name: 'Audit Logs',
    description: 'User-facing audit events',
    icon: Shield,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    customerVisible: true
  },
  internal: {
    name: 'Internal Logs',
    description: 'System and operational events',
    icon: Database,
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    customerVisible: false
  },
  test_invites: {
    name: 'Test Logs',
    description: 'Testing and development events',
    icon: TestTube,
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    customerVisible: false
  }
};

const STATUS_COLORS = {
  success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  warning: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
};

export function AdminLogsViewer() {
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LogFilters>({});
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['internal', 'test_invites']);
  const [liveTail, setLiveTail] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [organizations, setOrganizations] = useState<Array<{id: string, name: string}>>([]);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('json');
  
  const envConfig = getEnvironmentConfig();
  const canLiveTail = !envConfig.isProduction;

  useEffect(() => {
    loadOrganizations();
    loadLogs();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadLogs(false);
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, filters, selectedChannels]);

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setOrganizations(data || []);
    } catch (err) {
      console.error('Error loading organizations:', err);
    }
  };

  const loadLogs = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('audit_log')
        .select('*')
        .in('channel', selectedChannels)
        .order('created_at', { ascending: false })
        .limit(100);

      // Apply filters
      if (filters.action) {
        query = query.ilike('action', `%${filters.action}%`);
      }
      if (filters.actor_user_id) {
        query = query.eq('actor_user_id', filters.actor_user_id);
      }
      if (filters.target_type) {
        query = query.eq('target_type', filters.target_type);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.organization_id) {
        query = query.eq('organization_id', filters.organization_id);
      }
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to);
      }
      if (filters.search) {
        query = query.or(`action.ilike.%${filters.search}%,target_type.ilike.%${filters.search}%,target_id.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error loading logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load logs');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const exportLogs = async () => {
    try {
      setLoading(true);
      
      // Get all logs without limit for export
      let query = supabase
        .from('audit_log')
        .select('*')
        .in('channel', selectedChannels)
        .order('created_at', { ascending: false });

      // Apply same filters as display
      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== 'search') {
          if (key.includes('date')) {
            query = key === 'date_from' 
              ? query.gte('created_at', value)
              : query.lte('created_at', value);
          } else if (key === 'action') {
            query = query.ilike(key, `%${value}%`);
          } else {
            query = query.eq(key, value);
          }
        }
      });

      const { data, error } = await query;
      if (error) throw error;

      const filename = `admin-logs-${new Date().toISOString().split('T')[0]}`;
      
      if (exportFormat === 'csv') {
        const csv = convertToCSV(data || []);
        downloadFile(csv, `${filename}.csv`, 'text/csv');
      } else {
        const json = JSON.stringify(data, null, 2);
        downloadFile(json, `${filename}.json`, 'application/json');
      }

      toast({
        title: "Export Complete",
        description: `${data?.length || 0} log entries exported successfully.`,
      });
    } catch (err) {
      toast({
        title: "Export Failed",
        description: err instanceof Error ? err.message : "Failed to export logs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const convertToCSV = (data: AdminLogEntry[]): string => {
    const headers = ['timestamp', 'channel', 'action', 'status', 'actor_role', 'target_type', 'target_id', 'organization_id', 'error_code'];
    const rows = data.map(log => [
      log.created_at,
      log.channel,
      log.action,
      log.status,
      log.actor_role_snapshot,
      log.target_type,
      log.target_id || '',
      log.organization_id,
      log.error_code || ''
    ]);
    
    return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
  };

  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getDeepLink = (log: AdminLogEntry) => {
    if (log.target_type === 'organization' && log.target_id) {
      return `/admin/organizations?search=${log.target_id}`;
    }
    if (log.target_type === 'member' && log.organization_id) {
      return `/admin/members?org=${log.organization_id}`;
    }
    if (log.target_type === 'subscription' && log.target_id) {
      return `/admin/billing?search=${log.target_id}`;
    }
    return null;
  };

  const formatMetadata = (metadata: any) => {
    if (!metadata || typeof metadata !== 'object') return 'N/A';
    
    const important = ['reason', 'error', 'message', 'details', 'old_value', 'new_value'];
    const relevantKeys = Object.keys(metadata).filter(key => 
      important.includes(key) || metadata[key] !== null
    );
    
    if (relevantKeys.length === 0) return 'N/A';
    
    return relevantKeys.slice(0, 3).map(key => 
      `${key}: ${typeof metadata[key] === 'object' ? JSON.stringify(metadata[key]) : metadata[key]}`
    ).join(', ');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">Admin Logs</h2>
          <p className="text-muted-foreground">
            Internal system logs and development events
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canLiveTail && (
            <div className="flex items-center gap-2">
              <Switch
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                id="auto-refresh"
              />
              <Label htmlFor="auto-refresh" className="text-sm">Live Tail</Label>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => loadLogs(true)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {!canLiveTail && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Live tail is only available in development and staging environments.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Export
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Channel Selection */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Log Channels</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CHANNEL_CONFIGS).map(([key, config]) => {
                if (config.customerVisible) return null; // Only show admin channels
                const IconComponent = config.icon;
                return (
                  <Button
                    key={key}
                    variant={selectedChannels.includes(key) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedChannels(prev =>
                        prev.includes(key)
                          ? prev.filter(c => c !== key)
                          : [...prev, key]
                      );
                    }}
                    className="gap-2"
                  >
                    <IconComponent className="h-4 w-4" />
                    {config.name}
                  </Button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Action, target type, ID..."
                value={filters.search || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="organization">Organization</Label>
              <Select
                value={filters.organization_id || ''}
                onValueChange={(value) => setFilters(prev => ({ ...prev, organization_id: value || undefined }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All organizations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All organizations</SelectItem>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={filters.status || ''}
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value || undefined }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="target_type">Target Type</Label>
              <Select
                value={filters.target_type || ''}
                onValueChange={(value) => setFilters(prev => ({ ...prev, target_type: value || undefined }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                  <SelectItem value="invite">Invite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => loadLogs(true)}
                disabled={loading}
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                Apply Filters
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFilters({});
                  setSelectedChannels(['internal', 'test_invites']);
                }}
              >
                Clear All
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Select value={exportFormat} onValueChange={(value: 'csv' | 'json') => setExportFormat(value)}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={exportLogs}
                disabled={loading || logs.length === 0}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Log Entries ({logs.length})
            </CardTitle>
            {autoRefresh && (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                Live
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading && logs.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No log entries found matching your criteria</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const channelConfig = CHANNEL_CONFIGS[log.channel as keyof typeof CHANNEL_CONFIGS];
                const statusColor = STATUS_COLORS[log.status as keyof typeof STATUS_COLORS] || '';
                const deepLink = getDeepLink(log);
                const org = organizations.find(o => o.id === log.organization_id);

                return (
                  <div key={log.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={channelConfig?.color || ''}>
                            {channelConfig?.name || log.channel}
                          </Badge>
                          <Badge className={statusColor}>
                            {log.status}
                          </Badge>
                          <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                            {log.action}
                          </code>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                          </span>
                        </div>
                        
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-4">
                            <span><strong>Target:</strong> {log.target_type}</span>
                            {log.target_id && (
                              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                                {log.target_id}
                              </span>
                            )}
                            {org && (
                              <span><strong>Org:</strong> {org.name}</span>
                            )}
                          </div>
                          <div className="text-muted-foreground">
                            <strong>Metadata:</strong> {formatMetadata(log.metadata)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {deepLink && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(deepLink, '_blank')}
                            className="gap-1"
                          >
                            <Link className="h-3 w-3" />
                            View
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(log, null, 2));
                            toast({ title: "Copied to clipboard" });
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}