import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { 
  Filter, 
  RefreshCw, 
  Download, 
  Eye, 
  ExternalLink,
  Search,
  Shield,
  Building,
  Link as LinkIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface OrganizationActivityLog {
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
}

interface ActivityFilters {
  action?: string;
  actor_user_id?: string;
  target_type?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

interface OrganizationActivityAdminProps {
  organizationId?: string;
  organizationName?: string;
  showAllOrganizations?: boolean;
}

export function OrganizationActivityAdmin({ 
  organizationId, 
  organizationName,
  showAllOrganizations = false 
}: OrganizationActivityAdminProps) {
  const [logs, setLogs] = useState<OrganizationActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ActivityFilters>({});
  const [organizations, setOrganizations] = useState<Array<{id: string, name: string}>>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(organizationId || '');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('json');

  useEffect(() => {
    if (showAllOrganizations) {
      loadOrganizations();
    }
    if (organizationId || selectedOrgId) {
      loadActivityLogs();
    }
  }, [organizationId, selectedOrgId, showAllOrganizations]);

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

  const loadActivityLogs = async (showLoading = true) => {
    const targetOrgId = organizationId || selectedOrgId;
    if (!targetOrgId && !showAllOrganizations) return;

    if (showLoading) setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('audit_log')
        .select('*')
        .eq('channel', 'audit') // Only audit channel for customer-facing logs
        .order('created_at', { ascending: false })
        .limit(100);

      // Apply organization filter
      if (targetOrgId) {
        query = query.eq('organization_id', targetOrgId);
      }

      // Apply other filters
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
      console.error('Error loading activity logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load activity logs');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const exportLogs = async () => {
    try {
      setLoading(true);
      
      const targetOrgId = organizationId || selectedOrgId;
      let query = supabase
        .from('audit_log')
        .select('*')
        .eq('channel', 'audit')
        .order('created_at', { ascending: false });

      if (targetOrgId) {
        query = query.eq('organization_id', targetOrgId);
      }

      // Apply same filters as display
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
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      const { data, error } = await query;
      if (error) throw error;

      const orgName = organizationName || organizations.find(o => o.id === targetOrgId)?.name || 'all-orgs';
      const filename = `activity-logs-${orgName}-${new Date().toISOString().split('T')[0]}`;
      
      if (exportFormat === 'csv') {
        const csv = convertToCSV(data || []);
        downloadFile(csv, `${filename}.csv`, 'text/csv');
      } else {
        const json = JSON.stringify(data, null, 2);
        downloadFile(json, `${filename}.json`, 'application/json');
      }

      toast({
        title: "Export Complete",
        description: `${data?.length || 0} activity entries exported successfully.`,
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

  const convertToCSV = (data: OrganizationActivityLog[]): string => {
    const headers = ['timestamp', 'action', 'status', 'actor_role', 'target_type', 'target_id', 'organization_id', 'error_code'];
    const rows = data.map(log => [
      log.created_at,
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

  const getDeepLink = (log: OrganizationActivityLog) => {
    if (log.target_type === 'organization' && log.target_id) {
      return `/admin/organizations?search=${log.target_id}`;
    }
    if (log.target_type === 'member') {
      return `/admin/members?org=${log.organization_id}`;
    }
    if (log.target_type === 'subscription' && log.target_id) {
      return `/admin/billing?search=${log.target_id}`;
    }
    if (log.target_type === 'agent') {
      return `/admin/organizations?org=${log.organization_id}`;
    }
    return null;
  };

  const formatMetadata = (metadata: any) => {
    if (!metadata || typeof metadata !== 'object') return 'N/A';
    
    const important = ['reason', 'name', 'email', 'role', 'old_value', 'new_value'];
    const relevantKeys = Object.keys(metadata).filter(key => 
      important.includes(key) && metadata[key] !== null
    );
    
    if (relevantKeys.length === 0) return 'N/A';
    
    return relevantKeys.slice(0, 2).map(key => 
      `${key}: ${typeof metadata[key] === 'object' ? JSON.stringify(metadata[key]) : metadata[key]}`
    ).join(', ');
  };

  const STATUS_COLORS = {
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    warning: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Organization Activity
          </h2>
          <p className="text-muted-foreground">
            {organizationName ? `Activity logs for ${organizationName}` : 'Audit trail and security events'}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => loadActivityLogs(true)}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Export
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAllOrganizations && (
            <div>
              <Label htmlFor="organization">Organization</Label>
              <Select
                value={selectedOrgId}
                onValueChange={setSelectedOrgId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All organizations</SelectItem>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
              <Label htmlFor="action">Action</Label>
              <Input
                id="action"
                placeholder="e.g., member.added"
                value={filters.action || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
              />
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
                onClick={() => loadActivityLogs(true)}
                disabled={loading}
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                Apply Filters
              </Button>
              <Button
                variant="outline"
                onClick={() => setFilters({})}
              >
                Clear Filters
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
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Activity Logs ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && logs.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No activity logs found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const statusColor = STATUS_COLORS[log.status as keyof typeof STATUS_COLORS] || '';
                const deepLink = getDeepLink(log);
                const org = organizations.find(o => o.id === log.organization_id);

                return (
                  <div key={log.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
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
                            {showAllOrganizations && org && (
                              <span><strong>Org:</strong> {org.name}</span>
                            )}
                            <span><strong>Actor:</strong> {log.actor_role_snapshot}</span>
                          </div>
                          <div className="text-muted-foreground">
                            <strong>Details:</strong> {formatMetadata(log.metadata)}
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
                            <LinkIcon className="h-3 w-3" />
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