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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, Filter, RefreshCw, User, Calendar, Activity, Download, Eye, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useOrganizationRole } from '@/hooks/useOrganizationRole';

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

export function OrganizationActivityViewer() {
  const { organization, isOwner } = useUserOrganization();
  const { isAdmin } = useOrganizationRole(organization?.id);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [exporting, setExporting] = useState(false);

  // Check if user has access (Owner or Admin)
  const hasAccess = isOwner || isAdmin;

  const loadAuditLogs = async (reset = false) => {
    if (!organization?.id || !hasAccess) return;

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
  }, [organization?.id, hasAccess, filters]);

  const handleFilterChange = (key: keyof AuditFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const exportData = async (format: 'csv' | 'json') => {
    if (!organization?.id || !hasAccess) return;

    setExporting(true);
    try {
      // Get all data for export (using larger limit)
      const { data, error: rpcError } = await supabase.rpc('list_audit_log', {
        p_org_id: organization.id,
        p_filters: filters,
        p_cursor: null,
        p_limit: 1000
      });

      if (rpcError) throw rpcError;

      const exportData = (data || []).map(entry => {
        const { has_more, ...cleanEntry } = entry;
        return cleanEntry;
      });

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `organization-activity-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // CSV export
        const headers = ['Timestamp', 'Action', 'Actor', 'Target Type', 'Target ID', 'Status', 'Channel'];
        const csvData = [
          headers,
          ...exportData.map(log => [
            log.created_at,
            log.action,
            log.actor_user_id || 'System',
            log.target_type,
            log.target_id || '',
            log.status,
            log.channel
          ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `organization-activity-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
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
    if (!metadata || Object.keys(metadata).length === 0) return {};
    return metadata;
  };

  if (!hasAccess) {
    return (
      <Alert>
        <AlertDescription>
          Only organization owners and administrators can view activity logs.
        </AlertDescription>
      </Alert>
    );
  }

  if (!organization) {
    return (
      <Alert>
        <AlertDescription>
          Please select an organization to view activity logs.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Organization Activity
              </CardTitle>
              <CardDescription>
                Audit logs and security events for {organization.name}
              </CardDescription>
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
              <Select onValueChange={(value) => exportData(value as 'csv' | 'json')} disabled={exporting}>
                <SelectTrigger className="w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  {exporting ? 'Exporting...' : 'Export'}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">Export as CSV</SelectItem>
                  <SelectItem value="json">Export as JSON</SelectItem>
                </SelectContent>
              </Select>
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
        </CardHeader>

        <CardContent className="space-y-4">
          {showFilters && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            {loading && logs.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 border rounded-lg">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-3 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            ) : logs.length === 0 ? (
              <div className="p-8 text-center border rounded-lg">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No activity logs found</p>
              </div>
            ) : (
              logs.map((log) => (
                <Sheet key={log.id}>
                  <SheetTrigger asChild>
                    <div className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                      <div className="flex items-start justify-between mb-2">
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
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(log.created_at), 'MMM d, HH:mm')}
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>
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
                    </div>
                  </SheetTrigger>
                  <SheetContent className="w-[600px] sm:max-w-[600px]">
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        Activity Details
                      </SheetTitle>
                      <SheetDescription>
                        Full details for activity log entry
                      </SheetDescription>
                    </SheetHeader>
                    
                    <div className="mt-6 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Action</label>
                          <div className="mt-1">
                            <Badge variant={getActionBadgeVariant(log.action)}>
                              {log.action}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Status</label>
                          <div className="mt-1">
                            <Badge variant={getStatusBadgeVariant(log.status)}>
                              {log.status}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Actor</label>
                          <div className="mt-1 p-3 bg-muted rounded-md">
                            {log.actor_user_id ? (
                              <div className="space-y-1">
                                <div className="font-mono text-sm">{log.actor_user_id}</div>
                                <Badge variant="outline">{log.actor_role_snapshot}</Badge>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">System</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Target</label>
                          <div className="mt-1 p-3 bg-muted rounded-md">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{log.target_type}</Badge>
                                {log.target_id && (
                                  <code className="text-sm">{log.target_id}</code>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                          <div className="mt-1 p-3 bg-muted rounded-md font-mono text-sm">
                            {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')} UTC
                          </div>
                        </div>

                        {log.error_code && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Error Code</label>
                            <div className="mt-1 p-3 bg-destructive/10 text-destructive rounded-md font-mono text-sm">
                              {log.error_code}
                            </div>
                          </div>
                        )}
                      </div>

                      {Object.keys(formatMetadata(log.metadata)).length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Metadata</label>
                            <div className="mt-1 p-3 bg-muted rounded-md">
                              <pre className="text-xs whitespace-pre-wrap">
                                {JSON.stringify(formatMetadata(log.metadata), null, 2)}
                              </pre>
                            </div>
                          </div>
                        </>
                      )}

                      <Separator />

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Log ID</label>
                          <div className="mt-1 font-mono text-xs">{log.id}</div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Channel</label>
                          <div className="mt-1">
                            <Badge variant="secondary">{log.channel}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              ))
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
        </CardContent>
      </Card>
    </div>
  );
}