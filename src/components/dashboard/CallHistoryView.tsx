import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { History, Phone, Clock, TrendingUp, TrendingDown, Minus, Play, Download } from 'lucide-react'
import { useRetellCalls } from '@/hooks/useRetellCalls'
import { useRetellAgents } from '@/hooks/useRetellAgents'
import { useUserOrganization } from '@/hooks/useUserOrganization'
import { useToast } from '@/hooks/use-toast'

export const CallHistoryView = () => {
  const { organization } = useUserOrganization()
  const { calls, loading, loadCalls, getCallDetails, updateCallTags, getCallStats } = useRetellCalls(organization?.id)
  const { agents } = useRetellAgents(organization?.id)
  const { toast } = useToast()

  const [selectedCall, setSelectedCall] = useState<any>(null)
  const [callDetailsOpen, setCallDetailsOpen] = useState(false)
  const [filters, setFilters] = useState({
    dateRange: null as any,
    agentId: '',
    direction: undefined as 'inbound' | 'outbound' | undefined,
    status: '',
    outcome: ''
  })
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    if (organization?.id) {
      loadCalls(filters)
      loadStats()
    }
  }, [organization?.id, filters])

  const loadStats = async () => {
    try {
      const statsData = await getCallStats(filters)
      setStats(statsData)
    } catch (error) {
      console.error('Error loading call stats:', error)
    }
  }

  const handleViewCallDetails = async (call: any) => {
    try {
      const details = await getCallDetails(call.call_id)
      setSelectedCall(details)
      setCallDetailsOpen(true)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load call details.",
        variant: "destructive"
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Completed</Badge>
      case 'ongoing':
        return <Badge variant="secondary">Ongoing</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'canceled':
        return <Badge variant="outline">Canceled</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case 'positive':
        return <Badge variant="default" className="bg-green-100 text-green-800">Positive</Badge>
      case 'negative':
        return <Badge variant="destructive">Negative</Badge>
      case 'neutral':
        return <Badge variant="outline">Neutral</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      default:
        return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getAgentName = (agentId: string) => {
    const agent = agents?.find(a => a.agent_id === agentId)
    return agent?.name || 'Unknown Agent'
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageDuration}s</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Positive Outcome</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.positiveOutcome}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Agent</label>
              <Select value={filters.agentId} onValueChange={(value) => setFilters(prev => ({ ...prev, agentId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All agents</SelectItem>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.agent_id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Direction</label>
              <Select value={filters.direction} onValueChange={(value) => setFilters(prev => ({ ...prev, direction: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All directions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All directions</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Outcome</label>
              <Select value={filters.outcome} onValueChange={(value) => setFilters(prev => ({ ...prev, outcome: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All outcomes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All outcomes</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <Input placeholder="Search calls..." />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calls Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Call History
          </CardTitle>
          <CardDescription>
            View and analyze your call history with detailed information and analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading calls...</div>
            </div>
          ) : calls?.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No calls found</h3>
              <p className="text-muted-foreground">
                No calls match your current filters.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls?.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell>
                      {call.started_at ? new Date(call.started_at).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={call.direction === 'inbound' ? 'default' : 'outline'}>
                        {call.direction}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {call.direction === 'inbound' ? call.from_e164 : call.to_e164}
                    </TableCell>
                    <TableCell>
                      {call.agent_id ? getAgentName(call.agent_id) : '-'}
                    </TableCell>
                    <TableCell>
                      {call.duration_ms ? formatDuration(call.duration_ms) : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(call.status)}</TableCell>
                    <TableCell>
                      {call.outcome ? getOutcomeBadge(call.outcome) : '-'}
                    </TableCell>
                    <TableCell>
                      {call.sentiment ? getSentimentIcon(call.sentiment) : '-'}
                    </TableCell>
                    <TableCell>
                      {call.lead_score ? `${call.lead_score}/100` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewCallDetails(call)}
                        >
                          View
                        </Button>
                        {call.recording_signed_url && (
                          <Button variant="ghost" size="sm">
                            <Play className="h-4 w-4" />
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

      {/* Call Details Dialog */}
      <Dialog open={callDetailsOpen} onOpenChange={setCallDetailsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Call Details</DialogTitle>
            <DialogDescription>
              Detailed information and analysis for this call.
            </DialogDescription>
          </DialogHeader>
          {selectedCall && (
            <div className="space-y-6">
              {/* Call Overview */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Call Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Direction:</span>
                      <Badge variant={selectedCall.direction === 'inbound' ? 'default' : 'outline'}>
                        {selectedCall.direction}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <span>{selectedCall.duration_ms ? formatDuration(selectedCall.duration_ms) : '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      {getStatusBadge(selectedCall.status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Agent:</span>
                      <span>{selectedCall.agent_id ? getAgentName(selectedCall.agent_id) : '-'}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Outcome:</span>
                      {selectedCall.outcome ? getOutcomeBadge(selectedCall.outcome) : '-'}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sentiment:</span>
                      <div className="flex items-center gap-1">
                        {selectedCall.sentiment ? getSentimentIcon(selectedCall.sentiment) : '-'}
                        <span>{selectedCall.sentiment || '-'}</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lead Score:</span>
                      <span>{selectedCall.lead_score ? `${selectedCall.lead_score}/100` : '-'}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Summary and Topics */}
              {selectedCall.transcript_summary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Call Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{selectedCall.transcript_summary}</p>
                  </CardContent>
                </Card>
              )}

              {selectedCall.topics && selectedCall.topics.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Topics Discussed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedCall.topics.map((topic: string, index: number) => (
                        <Badge key={index} variant="outline">{topic}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recording */}
              {selectedCall.recording_signed_url && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Recording</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <audio controls className="w-full">
                      <source src={selectedCall.recording_signed_url} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                  </CardContent>
                </Card>
              )}

              {/* Raw Analysis Data */}
              {selectedCall.analysis_json && Object.keys(selectedCall.analysis_json).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Analysis Data</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-40">
                      {JSON.stringify(selectedCall.analysis_json, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}