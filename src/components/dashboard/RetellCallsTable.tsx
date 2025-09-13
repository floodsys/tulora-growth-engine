import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { 
  Phone, 
  Calendar as CalendarIcon, 
  Filter, 
  Play, 
  Download,
  Clock,
  User,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  RefreshCw
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { useRetellCalls, type RetellCall, type CallFilters } from "@/hooks/useRetellCalls"
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { CallDetailsDrawer } from "./CallDetailsDrawer"

export const RetellCallsTable = () => {
  const { organization } = useUserOrganization()
  const { 
    calls, 
    loading, 
    pagination, 
    loadCalls, 
    getCallDetails,
    getCallStats 
  } = useRetellCalls(organization?.id)

  const [selectedCall, setSelectedCall] = useState<RetellCall | null>(null)
  const [callDetails, setCallDetails] = useState<any>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [stats, setStats] = useState<any>(null)
  
  // Filter state
  const [filters, setFilters] = useState<CallFilters>({
    limit: 50,
    offset: 0
  })
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})

  // Load stats when filters change
  useEffect(() => {
    if (organization?.id) {
      getCallStats(filters).then(setStats)
    }
  }, [filters, organization?.id])

  const handleFilterChange = (key: keyof CallFilters, value: any) => {
    const newFilters = { ...filters, [key]: value, offset: 0 }
    setFilters(newFilters)
    loadCalls(newFilters)
  }

  const handleDateRangeChange = (range: { from?: Date; to?: Date }) => {
    setDateRange(range)
    if (range.from && range.to) {
      handleFilterChange('dateRange', {
        start: range.from.toISOString(),
        end: range.to.toISOString()
      })
    } else {
      handleFilterChange('dateRange', undefined)
    }
  }

  const handleCallClick = async (call: RetellCall) => {
    setSelectedCall(call)
    setDetailsLoading(true)
    try {
      const details = await getCallDetails(call.call_id)
      setCallDetails(details)
    } finally {
      setDetailsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: 'default',
      started: 'secondary',
      ongoing: 'secondary',
      failed: 'destructive',
      canceled: 'outline'
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  const getOutcomeBadge = (outcome?: string) => {
    if (!outcome) return <Badge variant="outline">Unknown</Badge>
    
    const variants: Record<string, any> = {
      positive: 'default',
      negative: 'destructive',
      neutral: 'secondary',
      unknown: 'outline'
    }
    
    const icons: Record<string, any> = {
      positive: <TrendingUp className="h-3 w-3 mr-1" />,
      negative: <TrendingDown className="h-3 w-3 mr-1" />,
      neutral: <Minus className="h-3 w-3 mr-1" />
    }
    
    return (
      <Badge variant={variants[outcome]} className="flex items-center">
        {icons[outcome]}
        {outcome}
      </Badge>
    )
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A'
    const seconds = Math.round(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatPhoneNumber = (phone: string) => {
    if (phone.startsWith('+1') && phone.length === 12) {
      return `(${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`
    }
    return phone
  }

  const refreshCalls = () => {
    loadCalls(filters)
  }

  if (loading && calls.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Call History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading calls...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% completion rate
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageDuration}s</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Positive Outcomes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.positiveOutcome}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0 ? Math.round((stats.positiveOutcome / stats.total) * 100) : 0}% success rate
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Phone className="h-5 w-5 mr-2" />
              Call History ({pagination.total})
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={refreshCalls}
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>
          
          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
              <div>
                <Label>Date Range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd")} -{" "}
                            {format(dateRange.to, "LLL dd")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        "Pick a date range"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange.from}
                      selected={{ from: dateRange.from, to: dateRange.to }}
                      onSelect={(range) => handleDateRangeChange(range || {})}
                      numberOfMonths={2}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <Label>Direction</Label>
                <Select 
                  value={filters.direction || ""} 
                  onValueChange={(value) => handleFilterChange('direction', value || undefined)}
                >
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
              
              <div>
                <Label>Status</Label>
                <Select 
                  value={filters.status || ""} 
                  onValueChange={(value) => handleFilterChange('status', value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="started">Started</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Outcome</Label>
                <Select 
                  value={filters.outcome || ""} 
                  onValueChange={(value) => handleFilterChange('outcome', value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All outcomes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All outcomes</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          {calls.length === 0 ? (
            <div className="text-center py-12">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Calls Found</h3>
              <p className="text-muted-foreground">
                {Object.keys(filters).some(key => filters[key as keyof CallFilters])
                  ? "No calls match your current filters."
                  : "No calls have been recorded yet."}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((call) => (
                    <TableRow 
                      key={call.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleCallClick(call)}
                    >
                      <TableCell className="font-medium">
                        <div>
                          <div>{format(new Date(call.started_at || call.created_at), "MMM dd, HH:mm")}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(call.started_at || call.created_at), { addSuffix: true })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={call.direction === 'inbound' ? 'default' : 'secondary'}>
                          {call.direction}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatPhoneNumber(call.direction === 'inbound' ? call.from_e164 : call.to_e164)}
                      </TableCell>
                      <TableCell>
                        {call.retell_agents?.name || call.agent_id || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                          {formatDuration(call.duration_ms)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(call.status)}</TableCell>
                      <TableCell>{getOutcomeBadge(call.outcome)}</TableCell>
                      <TableCell>
                        {call.lead_score !== null && call.lead_score !== undefined ? (
                          <div className="flex items-center">
                            <div className="w-12 h-2 bg-muted rounded-full mr-2">
                              <div 
                                className="h-2 bg-primary rounded-full" 
                                style={{ width: `${call.lead_score}%` }}
                              />
                            </div>
                            <span className="text-sm">{call.lead_score}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              {pagination.hasMore && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const newFilters = { ...filters, offset: pagination.offset + pagination.limit }
                      setFilters(newFilters)
                      loadCalls(newFilters)
                    }}
                    disabled={loading}
                  >
                    Load More ({pagination.total - pagination.offset - pagination.limit} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Call Details Drawer */}
      <CallDetailsDrawer
        call={selectedCall}
        callDetails={callDetails}
        loading={detailsLoading}
        onClose={() => {
          setSelectedCall(null)
          setCallDetails(null)
        }}
      />
    </div>
  )
}