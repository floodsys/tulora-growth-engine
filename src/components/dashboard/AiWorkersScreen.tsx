/**
 * AI Workers Screen
 * 
 * Unified dashboard view combining agent, number, and usage data
 * into a single table/card grid view with status, linked numbers,
 * and call metrics for each AI worker.
 */

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Bot,
  Phone,
  Plus,
  Search,
  MoreVertical,
  Settings,
  Play,
  Pause,
  Archive,
  ArchiveX,
  PhoneCall,
  Clock,
  TrendingUp,
  Hash,
  RefreshCw,
  Users,
  Zap,
  Cloud,
  CloudOff,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'

import { useUserOrganization } from '@/hooks/useUserOrganization'
import { useAiWorkers } from '@/hooks/useAiWorkers'
import { useEntitlements } from '@/lib/entitlements/ssot'
import {
  AgentStatus,
  AgentStatusType,
  AGENT_STATUS_DISPLAY,
  getAllowedTransitions,
  getTransitionLabel,
  canMakeTestCalls
} from '@/lib/agents/types'
import { AiWorkerRow, AiWorkersFilter, CrmSyncStatus } from '@/lib/aiWorkers/types'

// Status badge component
function WorkerStatusBadge({ status }: { status: AgentStatusType }) {
  const display = AGENT_STATUS_DISPLAY[status]

  const variantMap: Record<string, string> = {
    default: 'bg-gray-100 text-gray-800',
    secondary: 'bg-gray-100 text-gray-600',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    destructive: 'bg-red-100 text-red-800',
  }

  return (
    <Badge className={variantMap[display.variant] || variantMap.default}>
      {display.label}
    </Badge>
  )
}

// Linked numbers display
function LinkedNumbersDisplay({ numbers }: { numbers: AiWorkerRow['linked_numbers'] }) {
  if (numbers.length === 0) {
    return <span className="text-muted-foreground text-sm">No numbers</span>
  }

  if (numbers.length === 1) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <span className="text-sm font-mono">{numbers[0].e164}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{numbers[0].type} • {numbers[0].country || 'Unknown'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <span className="text-sm">
            <span className="font-mono">{numbers[0].e164}</span>
            <span className="text-muted-foreground ml-1">+{numbers.length - 1} more</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            {numbers.map((num, i) => (
              <p key={i} className="font-mono text-xs">
                {num.e164} ({num.type})
              </p>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Last call display
function LastCallDisplay({ worker }: { worker: AiWorkerRow }) {
  if (!worker.last_call_at) {
    return <span className="text-muted-foreground text-sm">No calls yet</span>
  }

  const date = new Date(worker.last_call_at)
  const timeAgo = getTimeAgo(date)
  const duration = worker.last_call_duration
    ? formatDuration(worker.last_call_duration)
    : 'N/A'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className="text-sm">
            <span>{timeAgo}</span>
            {worker.last_call_result && (
              <Badge
                variant="outline"
                className="ml-2 text-xs"
              >
                {worker.last_call_result}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{date.toLocaleString()}</p>
          <p>Duration: {duration}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Helper functions
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

// CRM Status Indicator component
function CrmStatusIndicator({ status, loading }: {
  status: CrmSyncStatus | null
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
    )
  }

  // No CRM data or not configured
  if (!status || !status.configured) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CloudOff className="h-4 w-4" />
              <span>CRM: Not connected</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>SuiteCRM integration not configured</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Has failed syncs
  if (status.failedCount > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 text-sm text-orange-600">
              <AlertTriangle className="h-4 w-4" />
              <span>CRM: {status.failedCount} failed</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">CRM Sync Status</p>
              <p>✓ Synced: {status.syncedCount}</p>
              <p>⏳ Pending: {status.pendingCount}</p>
              <p className="text-orange-500">✗ Failed: {status.failedCount}</p>
              {status.lastError && (
                <p className="text-xs text-muted-foreground mt-2 max-w-[250px] truncate">
                  Last error: {status.lastError}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Has pending syncs
  if (status.pendingCount > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Cloud className="h-4 w-4 animate-pulse" />
              <span>CRM: {status.pendingCount} pending</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">CRM Sync Status</p>
              <p>✓ Synced: {status.syncedCount}</p>
              <p className="text-blue-500">⏳ Pending: {status.pendingCount}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // All good
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>CRM: OK</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">CRM Sync Status</p>
            <p className="text-green-500">✓ Synced: {status.syncedCount}</p>
            {status.lastSyncedAt && (
              <p className="text-xs text-muted-foreground">
                Last sync: {new Date(status.lastSyncedAt).toLocaleString()}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Summary cards component
function SummaryCards({ summary, loading }: {
  summary: ReturnType<typeof useAiWorkers>['summary']
  loading: boolean
}) {
  const cards = [
    {
      title: 'Total Workers',
      value: summary?.totalWorkers ?? 0,
      icon: Users,
      description: 'AI agents configured'
    },
    {
      title: 'Active',
      value: summary?.activeWorkers ?? 0,
      icon: Zap,
      description: 'Currently live',
      color: 'text-green-600'
    },
    {
      title: 'Month Calls',
      value: summary?.totalMonthCalls ?? 0,
      icon: PhoneCall,
      description: 'Calls this month'
    },
    {
      title: 'Month Minutes',
      value: summary?.totalMonthMinutes ?? 0,
      icon: Clock,
      description: 'Minutes this month'
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.color || 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Worker row actions dropdown
function WorkerActions({
  worker,
  onStatusChange,
  onSettings,
  onTestCall
}: {
  worker: AiWorkerRow
  onStatusChange: (workerId: string, newStatus: AgentStatusType) => void
  onSettings: (worker: AiWorkerRow) => void
  onTestCall: (worker: AiWorkerRow) => void
}) {
  const allowedTransitions = getAllowedTransitions(worker.status)
  const canTest = canMakeTestCalls(worker.status)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onSettings(worker)}>
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </DropdownMenuItem>

        {canTest && (
          <DropdownMenuItem onClick={() => onTestCall(worker)}>
            <Phone className="h-4 w-4 mr-2" />
            Test Call
          </DropdownMenuItem>
        )}

        {allowedTransitions.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {allowedTransitions.map(toStatus => (
              <DropdownMenuItem
                key={toStatus}
                onClick={() => onStatusChange(worker.id, toStatus)}
              >
                {toStatus === AgentStatus.ACTIVE && <Play className="h-4 w-4 mr-2" />}
                {toStatus === AgentStatus.PAUSED && <Pause className="h-4 w-4 mr-2" />}
                {toStatus === AgentStatus.ARCHIVED && <Archive className="h-4 w-4 mr-2" />}
                {toStatus === AgentStatus.TESTING && <Phone className="h-4 w-4 mr-2" />}
                {getTransitionLabel(worker.status, toStatus)}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Main component
export function AiWorkersScreen() {
  const navigate = useNavigate()
  const { organizationId } = useUserOrganization()
  const { entitlements } = useEntitlements(organizationId)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [numbersFilter, setNumbersFilter] = useState<string>('all')
  const [showArchived, setShowArchived] = useState(false) // Hidden by default

  // Build filters object
  const filters = useMemo<AiWorkersFilter>(() => {
    const f: AiWorkersFilter = {}

    if (searchQuery) {
      f.search = searchQuery
    }

    // If a specific status is selected, use it
    if (statusFilter !== 'all') {
      f.status = statusFilter as AgentStatusType
    } else if (!showArchived) {
      // By default, exclude ARCHIVED when "All Status" is selected
      f.excludeArchived = true
    }

    if (numbersFilter === 'with') {
      f.hasNumbers = true
    } else if (numbersFilter === 'without') {
      f.hasNumbers = false
    }

    return f
  }, [searchQuery, statusFilter, numbersFilter, showArchived])

  // Fetch workers
  const {
    workers,
    summary,
    crmStatus,
    loading,
    refetch,
    updateWorkerStatus
  } = useAiWorkers({
    organizationId,
    filters,
    autoRefresh: true,
    refreshInterval: 30000
  })

  // Handlers
  const handleStatusChange = async (workerId: string, newStatus: AgentStatusType) => {
    await updateWorkerStatus(workerId, newStatus)
  }

  const handleSettings = (worker: AiWorkerRow) => {
    navigate(`/agent/${worker.id}/settings`)
  }

  const handleTestCall = (worker: AiWorkerRow) => {
    // Navigate to calls screen with agent pre-selected
    navigate(`/dashboard?tab=calls&agent=${worker.agent_id}`)
  }

  const handleCreateAgent = () => {
    navigate('/dashboard?tab=agents')
  }

  // Check agent limit
  const agentLimit = entitlements.limits.agents
  const canCreateAgent = agentLimit === null || (summary?.totalWorkers ?? 0) < agentLimit

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            AI Workers
          </h1>
          <div className="flex items-center gap-4">
            <p className="text-muted-foreground">
              Manage your AI voice agents and their phone numbers
            </p>
            <CrmStatusIndicator status={crmStatus} loading={loading} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    onClick={handleCreateAgent}
                    disabled={!canCreateAgent}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Agent
                  </Button>
                </span>
              </TooltipTrigger>
              {!canCreateAgent && (
                <TooltipContent>
                  <p>Agent limit reached ({agentLimit}). Upgrade your plan.</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards summary={summary} loading={loading} />

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value={AgentStatus.DRAFT}>Draft</SelectItem>
                <SelectItem value={AgentStatus.TESTING}>Testing</SelectItem>
                <SelectItem value={AgentStatus.ACTIVE}>Active</SelectItem>
                <SelectItem value={AgentStatus.PAUSED}>Paused</SelectItem>
                <SelectItem value={AgentStatus.ARCHIVED}>Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select value={numbersFilter} onValueChange={setNumbersFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Numbers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Numbers</SelectItem>
                <SelectItem value="with">With Numbers</SelectItem>
                <SelectItem value="without">Without Numbers</SelectItem>
              </SelectContent>
            </Select>

            {/* Show Archived Toggle - only visible when not filtering by specific status */}
            {statusFilter === 'all' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showArchived ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setShowArchived(!showArchived)}
                      className="whitespace-nowrap"
                    >
                      {showArchived ? (
                        <>
                          <ArchiveX className="h-4 w-4 mr-2" />
                          Hide Archived
                        </>
                      ) : (
                        <>
                          <Archive className="h-4 w-4 mr-2" />
                          Show Archived
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{showArchived ? 'Hide archived agents from list' : 'Include archived agents in list'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Workers</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : `${workers.length} worker${workers.length !== 1 ? 's' : ''} found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : workers.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No AI Workers Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all' || numbersFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create your first AI agent to get started'}
              </p>
              {canCreateAgent && (
                <Button onClick={handleCreateAgent}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Agent
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Hash className="h-4 w-4" />
                        Numbers
                      </div>
                    </TableHead>
                    <TableHead>Last Call</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        Month
                      </div>
                    </TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workers.map(worker => (
                    <TableRow key={worker.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{worker.name}</div>
                            {worker.description && (
                              <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {worker.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <WorkerStatusBadge status={worker.status} />
                      </TableCell>
                      <TableCell>
                        <LinkedNumbersDisplay numbers={worker.linked_numbers} />
                      </TableCell>
                      <TableCell>
                        <LastCallDisplay worker={worker} />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{worker.month_calls ?? 0} calls</div>
                          <div className="text-muted-foreground">{worker.month_minutes ?? 0} min</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <WorkerActions
                          worker={worker}
                          onStatusChange={handleStatusChange}
                          onSettings={handleSettings}
                          onTestCall={handleTestCall}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default AiWorkersScreen
