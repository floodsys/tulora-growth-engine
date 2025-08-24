import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, Filter, RefreshCw, User, Calendar, Activity } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLogEntry {
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
  has_more: boolean;
}

interface AuditFilters {
  action?: string;
  actor_user_id?: string;
  target_type?: string;
  status?: string;
  channel?: string;
  date_from?: string;
  date_to?: string;
  [key: string]: string | undefined;
}

export function AuditLogViewer() {
  const { organization } = useUserOrganization();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const loadAuditLogs = async (reset = false) => {
    if (!organization?.id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('list_audit_log', {
        p_org_id: organization.id,
        p_filters: filters,
        p_cursor: reset ? null : cursor,
        p_limit: 25
      });

      if (rpcError) throw rpcError;

      const entries = data || [];
      const hasMoreEntries = entries.length > 0 && entries[entries.length - 1]?.has_more;
      
      // Remove the has_more flag from the last entry
      const cleanEntries = entries.map(entry => {
        const { has_more, ...cleanEntry } = entry;
        return cleanEntry as AuditLogEntry;
      });

      if (reset) {
        setLogs(cleanEntries);
        setCursor(cleanEntries.length > 0 ? cleanEntries[cleanEntries.length - 1].created_at : null);
      } else {
        setLogs(prev => [...prev, ...cleanEntries]);
        setCursor(cleanEntries.length > 0 ? cleanEntries[cleanEntries.length - 1].created_at : cursor);
      }
      
      setHasMore(hasMoreEntries);
    } catch (err) {
      console.error('Error loading audit logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs(true);
  }, [organization?.id, filters]);

  const handleFilterChange = (key: keyof AuditFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('failed') || action.includes('error') || action.includes('blocked')) {
      return 'destructive';
    }
    if (action.includes('created') || action.includes('added') || action.includes('accepted')) {
      return 'default';
    }
    if (action.includes('updated') || action.includes('changed')) {
      return 'secondary';
    }
    if (action.includes('deleted') || action.includes('removed') || action.includes('revoked')) {
      return 'outline';
    }
    return 'secondary';
  };

  const getStatusBadgeVariant = (status: string) => {
    return status === 'error' ? 'destructive' : 'default';
  };

  const formatMetadata = (metadata: any) => {
    if (!metadata || Object.keys(metadata).length === 0) return null;
    
    const importantKeys = ['email', 'role', 'old_role', 'new_role', 'changes', 'error'];
    const relevantData = {};
    
    importantKeys.forEach(key => {
      if (metadata[key] !== undefined) {
        relevantData[key] = metadata[key];
      }
    });
    
    return Object.keys(relevantData).length > 0 ? relevantData : metadata;
  };

  if (!organization) {
    return (
      <Alert>
        <AlertDescription>
          Please select an organization to view audit logs.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit Logs</h2>
          <p className="text-muted-foreground">
            Security and activity logs for {organization.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            <ChevronDown className={`h-4 w-4 ml-2 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAuditLogs(true)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filter Audit Logs</CardTitle>
            <CardDescription>
              Filter logs by action, user, type, or date range
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium">Action</label>
              <Input
                placeholder="e.g. invite.created"
                value={filters.action || ''}
                onChange={(e) => handleFilterChange('action', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Target Type</label>
              <Select value={filters.target_type || ''} onValueChange={(value) => handleFilterChange('target_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="invite">Invite</SelectItem>
                  <SelectItem value="org">Organization</SelectItem>
                  <SelectItem value="integration">Integration</SelectItem>
                  <SelectItem value="file">File</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={filters.status || ''} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Date From</label>
              <Input
                type="date"
                value={filters.date_from || ''}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-sm font-medium">Date To</label>
                <Input
                  type="date"
                  value={filters.date_to || ''}
                  onChange={(e) => handleFilterChange('date_to', e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {loading && logs.length === 0 ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-3 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))
        ) : logs.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No audit logs found</p>
            </CardContent>
          </Card>
        ) : (
          logs.map((log) => {
            const metadata = formatMetadata(log.metadata);
            return (
              <Card key={log.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {log.action}
                      </Badge>
                      <Badge variant="outline">{log.target_type}</Badge>
                      <Badge variant={getStatusBadgeVariant(log.status)}>
                        {log.status}
                      </Badge>
                      {log.channel !== 'audit' && (
                        <Badge variant="secondary">{log.channel}</Badge>
                      )}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-1" />
                      {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {log.actor_user_id ? (
                        <>
                          User <code className="text-xs bg-muted px-1 py-0.5 rounded">{log.actor_user_id.slice(0, 8)}...</code>
                          <Badge variant="outline" className="ml-2">{log.actor_role_snapshot}</Badge>
                        </>
                      ) : (
                        <span className="text-muted-foreground">System</span>
                      )}
                    </span>
                  </div>

                  {log.target_id && (
                    <div className="text-sm text-muted-foreground mb-2">
                      Target: <code className="text-xs bg-muted px-1 py-0.5 rounded">{log.target_id}</code>
                    </div>
                  )}

                  {log.error_code && (
                    <div className="text-sm text-destructive mb-2">
                      Error: {log.error_code}
                    </div>
                  )}

                  {metadata && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-md">
                      <details>
                        <summary className="text-sm font-medium cursor-pointer">
                          Additional Details
                        </summary>
                        <pre className="text-xs mt-2 whitespace-pre-wrap">
                          {JSON.stringify(metadata, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}

        {hasMore && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => loadAuditLogs(false)}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load More'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}