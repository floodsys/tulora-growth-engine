import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, CheckCircle, Clock, RefreshCw, ExternalLink, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { format } from "date-fns"

interface CRMSyncEntry {
  id: string
  lead_id: string
  attempt_count: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  last_error?: string
  next_attempt_at: string
  created_at: string
  updated_at: string
  leads: {
    full_name: string
    email: string
    crm_sync_status: string
    crm_synced_at?: string
    crm_url?: string
  }
}

interface SyncSummary {
  total: number
  completed: number
  pending: number
  failed: number
  processing: number
}

interface CRMAdminPanelProps {
  organizationId: string
}

export function CRMAdminPanel({ organizationId }: CRMAdminPanelProps) {
  const [entries, setEntries] = useState<CRMSyncEntry[]>([])
  const [summary, setSummary] = useState<SyncSummary>({
    total: 0,
    completed: 0,
    pending: 0,
    failed: 0,
    processing: 0
  })
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchSyncData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('crm-admin', {
        method: 'GET',
        body: { organization_id: organizationId }
      })

      if (error) throw error

      if (data?.success) {
        setEntries(data.entries || [])
        setSummary(data.summary || {
          total: 0,
          completed: 0,
          pending: 0,
          failed: 0,
          processing: 0
        })
      } else {
        throw new Error(data?.error || 'Failed to fetch sync data')
      }
    } catch (error) {
      console.error('Failed to fetch CRM sync data:', error)
      toast({
        title: "Error",
        description: "Failed to load CRM sync data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = async (leadId?: string) => {
    setRetrying(leadId || 'all')
    
    try {
      const { data, error } = await supabase.functions.invoke('crm-admin', {
        body: leadId ? { lead_id: leadId } : { organization_id: organizationId }
      })

      if (error) throw error

      if (data?.success) {
        toast({
          title: "Retry Queued",
          description: data.message
        })
        
        // Refresh data after a short delay
        setTimeout(fetchSyncData, 2000)
      } else {
        throw new Error(data?.error || 'Retry failed')
      }
    } catch (error) {
      toast({
        title: "Retry Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      })
    } finally {
      setRetrying(null)
    }
  }

  useEffect(() => {
    if (organizationId) {
      fetchSyncData()
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchSyncData, 30000)
      return () => clearInterval(interval)
    }
  }, [organizationId])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'processing': return <Clock className="h-4 w-4 text-blue-500" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />
      default: return <AlertTriangle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variant = status === 'completed' ? 'default' : 
                   status === 'failed' ? 'destructive' :
                   status === 'processing' ? 'secondary' : 'outline'
    
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SuiteCRM Sync Status</CardTitle>
          <CardDescription>Loading sync data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{summary.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{summary.completed}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{summary.pending}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{summary.processing}</div>
            <div className="text-sm text-muted-foreground">Processing</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
            <div className="text-sm text-muted-foreground">Failed</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>SuiteCRM Sync Status</CardTitle>
              <CardDescription>Last 50 sync attempts for your organization</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchSyncData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {summary.failed > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => handleRetry()}
                  disabled={retrying === 'all'}
                >
                  {retrying === 'all' ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Retry All Failed
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sync attempts found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Next Attempt</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{entry.leads.full_name}</div>
                        <div className="text-sm text-muted-foreground">{entry.leads.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getStatusBadge(entry.status)}
                        {entry.last_error && (
                          <div className="text-xs text-red-500 max-w-[200px] truncate" title={entry.last_error}>
                            {entry.last_error}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{entry.attempt_count}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(entry.updated_at), 'MMM d, HH:mm')}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.status === 'pending' && (
                        <div className="text-sm">
                          {format(new Date(entry.next_attempt_at), 'MMM d, HH:mm')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {entry.status === 'failed' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleRetry(entry.lead_id)}
                            disabled={retrying === entry.lead_id}
                          >
                            {retrying === entry.lead_id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                        {entry.leads.crm_url && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(entry.leads.crm_url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}