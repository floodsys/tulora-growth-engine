import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Search, Phone, Users, MoreHorizontal, PhoneCall, Clock, TrendingUp, Filter, BarChart3 } from "lucide-react"
import { TranscriptViewer } from "./widgets/TranscriptViewer"
import { RecordingPlayer } from "./widgets/RecordingPlayer"
import { formatDistanceToNow } from "date-fns"
import { useRetellCalls } from "@/hooks/useRetellCalls"
import { useRetellAnalytics } from "@/hooks/useRetellAnalytics"
import { useToast } from "@/hooks/use-toast"
import { useUserOrganization } from "@/hooks/useUserOrganization"

// Helper for correlation ID extraction
const getCorrId = (err: any) => err?.correlationId ?? err?.corr ?? err?.traceId ?? null

interface Call {
  id: string
  caller: string
  phone: string
  outcome: string
  sentiment: "positive" | "neutral" | "negative"
  duration: number
  owner: string
  timestamp: Date
  recordingUrl?: string
  summary?: string
  cost?: number
  tokenUsage?: number
}

const mockCalls: Call[] = [
  {
    id: "1",
    caller: "John Smith",
    phone: "+1 (555) 123-4567",
    outcome: "Interested",
    sentiment: "positive",
    duration: 180,
    owner: "Sarah J.",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    recordingUrl: "/mock-recording.mp3",
    summary: "Customer showed strong interest in our AI outreach solution. Mentioned current pain points with manual outreach. Scheduled follow-up demo for next week.",
    cost: 0.45,
    tokenUsage: 1250
  },
  {
    id: "2",
    caller: "Jane Doe", 
    phone: "+1 (555) 987-6543",
    outcome: "Not Interested",
    sentiment: "negative",
    duration: 45,
    owner: "Mike R.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    recordingUrl: "/mock-recording.mp3",
    summary: "Customer not interested at this time. Has existing solution they're happy with. Added to follow-up list for Q2 next year.",
    cost: 0.12,
    tokenUsage: 340
  },
  {
    id: "3",
    caller: "Bob Wilson",
    phone: "+1 (555) 456-7890", 
    outcome: "Follow Up",
    sentiment: "neutral",
    duration: 120,
    owner: "Lisa K.",
    timestamp: new Date(Date.now() - 1000 * 60 * 90),
    recordingUrl: "/mock-recording.mp3",
    summary: "Customer needs to discuss with team. Interested but requires approval from leadership. Sending proposal and scheduling follow-up in 2 weeks.",
    cost: 0.32,
    tokenUsage: 890
  }
]

const mockTranscript = [
  {
    id: "1",
    speaker: "agent" as const,
    text: "Hi, this is Sarah from AI Outreach. I hope you're having a great day! I'm calling because I noticed your company has been expanding rapidly, and I wanted to share how we've helped similar companies streamline their outreach process.",
    timestamp: "00:05",
    confidence: 0.95
  },
  {
    id: "2", 
    speaker: "user" as const,
    text: "Oh hi there. Yeah, we've been growing pretty fast actually. What exactly do you do?",
    timestamp: "00:15",
    confidence: 0.92
  },
  {
    id: "3",
    speaker: "agent" as const,
    text: "Great question! We provide AI-powered outreach automation that can help you scale your sales efforts without losing that personal touch. Our clients typically see a 3x increase in qualified leads within the first month.",
    timestamp: "00:20",
    confidence: 0.97
  }
]

const AllCallsTab = ({ realCalls, hasRealData, realTotal }: { 
  realCalls: any[], 
  hasRealData: boolean, 
  realTotal: number 
}) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Use real data when available, fallback to mocks
  const dataSource = hasRealData ? realCalls : mockCalls
  const filteredCalls = dataSource.filter(call =>
    call.caller.toLowerCase().includes(searchTerm.toLowerCase()) ||
    call.phone.includes(searchTerm) ||
    call.outcome.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-success text-success-foreground"
      case "negative":
        return "bg-destructive text-destructive-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleCallSelect = (call: Call) => {
    setSelectedCall(call)
    setDetailOpen(true)
  }

  const handleRedial = (call: Call) => {
    console.log("Redialing with context:", call)
  }

  const handleWarmTransfer = (call: Call) => {
    console.log("Warm transfer with context:", call)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>All Calls</CardTitle>
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search calls by caller, phone, or outcome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Zero state for no calls */}
          {realTotal === 0 && hasRealData && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No calls yet</h3>
                  <p className="text-muted-foreground mt-2">
                    Start making calls to see your activity here
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Calls Table */}
          {(filteredCalls.length > 0 || !hasRealData) && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Caller</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCalls.map((call) => (
                <TableRow 
                  key={call.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleCallSelect(call)}
                >
                  <TableCell className="font-medium">{call.caller}</TableCell>
                  <TableCell className="text-muted-foreground">{call.phone}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{call.outcome}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getSentimentColor(call.sentiment)}>
                      {call.sentiment}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDuration(call.duration)}</TableCell>
                  <TableCell>{call.owner}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(call.timestamp, { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCallSelect(call)
                      }}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Call Detail Drawer */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>Call Details</SheetTitle>
            <SheetDescription>
              {selectedCall?.caller} • {selectedCall?.phone}
            </SheetDescription>
          </SheetHeader>

          {selectedCall && (
            <div className="mt-6 space-y-6">
              {/* Actions */}
              <div className="flex gap-2">
                <Button onClick={() => handleRedial(selectedCall)}>
                  <Phone className="h-4 w-4 mr-2" />
                  Redial
                </Button>
                <Button variant="outline" onClick={() => handleWarmTransfer(selectedCall)}>
                  <Users className="h-4 w-4 mr-2" />
                  Warm Transfer
                </Button>
              </div>

              {/* Analysis Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Call Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Summary</h4>
                    <p className="text-sm text-muted-foreground">{selectedCall.summary}</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium">Sentiment</p>
                      <Badge className={getSentimentColor(selectedCall.sentiment)}>
                        {selectedCall.sentiment}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Cost</p>
                      <p className="text-sm text-muted-foreground">${selectedCall.cost?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Tokens Used</p>
                      <p className="text-sm text-muted-foreground">{selectedCall.tokenUsage?.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recording Player */}
              {selectedCall.recordingUrl && (
                <RecordingPlayer recordingUrl={selectedCall.recordingUrl} />
              )}

              {/* Transcript */}
              <TranscriptViewer segments={mockTranscript} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

const AnalyticsTab = ({ analytics, hasAnalytics }: { analytics: any, hasAnalytics: boolean }) => {
  // KPI variables with real data and safe fallbacks
  const totalCalls = hasAnalytics ? (analytics?.totalCalls || 0) : 1234
  const successfulCalls = hasAnalytics ? (analytics?.completedCalls || 0) : 892
  const avgDuration = hasAnalytics ? (analytics?.averageDuration ? `${Math.floor(analytics.averageDuration / 60)}:${(analytics.averageDuration % 60).toString().padStart(2, '0')}` : '0:00') : '4:32'
  const successRate = hasAnalytics ? (analytics?.successRate ? `${Math.round(analytics.successRate)}%` : '0%') : '72%'

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+10% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful Calls</CardTitle>
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successfulCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+5% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgDuration}</div>
            <p className="text-xs text-muted-foreground">+2% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}</div>
            <p className="text-xs text-muted-foreground">+8% from last month</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Call Performance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Advanced analytics charts coming soon...</p>
        </CardContent>
      </Card>
    </div>
  )
}

const ScheduledTab = () => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Scheduled Calls</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">No scheduled calls at the moment.</p>
      </CardContent>
    </Card>
  </div>
)

const ReportsTab = () => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Call Reports
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Detailed call reports and exports coming soon...</p>
      </CardContent>
    </Card>
  </div>
)

export function CallsScreen() {
  const { toast } = useToast()
  const { organization } = useUserOrganization()
  
  // Initialize real data hooks
  const { calls: realCalls, loading: callsLoading, getCallStats } = useRetellCalls(organization?.id)
  const { analytics, loading: analyticsLoading, loadAnalytics } = useRetellAnalytics(organization?.id)
  
  // Error handling with correlation ID
  const handleError = (error: any, operation: string) => {
    const corrId = getCorrId(error)
    const message = `Failed to ${operation}${corrId ? ` (Corr ID: ${corrId})` : ''}`
    console.error('CallsScreen error:', { corrId, error, operation })
    toast({
      title: "Error",
      description: message,
      variant: "destructive"
    })
  }

  // Derive real data with fallbacks
  const realTotal = realCalls?.length || 0
  const hasRealData = !callsLoading && realCalls && realCalls.length > 0

  return (
    <div className="h-full max-h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Calls</h1>
        <p className="text-muted-foreground">Monitor and analyze your call activities</p>
      </div>
      
      <Tabs defaultValue="all" className="h-full flex flex-col">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="all">ALL CALLS</TabsTrigger>
          <TabsTrigger value="analytics">ANALYTICS</TabsTrigger>
          <TabsTrigger value="scheduled">SCHEDULED</TabsTrigger>
          <TabsTrigger value="reports">REPORTS</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="flex-1 mt-6">
          <AllCallsTab 
            realCalls={realCalls || []} 
            hasRealData={hasRealData} 
            realTotal={realTotal} 
          />
        </TabsContent>
        
        <TabsContent value="analytics" className="flex-1 mt-6">
          <AnalyticsTab 
            analytics={analytics} 
            hasAnalytics={!analyticsLoading && !!analytics} 
          />
        </TabsContent>
        
        <TabsContent value="scheduled" className="flex-1 mt-6">
          <ScheduledTab />
        </TabsContent>
        
        <TabsContent value="reports" className="flex-1 mt-6">
          <ReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}