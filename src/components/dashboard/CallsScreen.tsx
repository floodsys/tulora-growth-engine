import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Search, Phone, Users, MoreHorizontal } from "lucide-react"
import { TranscriptViewer } from "./widgets/TranscriptViewer"
import { RecordingPlayer } from "./widgets/RecordingPlayer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDistanceToNow } from "date-fns"

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

export function CallsScreen() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const filteredCalls = mockCalls.filter(call =>
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
    // Implement redial logic - reuse context from previous call
    console.log("Redialing with context:", call)
  }

  const handleWarmTransfer = (call: Call) => {
    // Implement warm transfer logic
    console.log("Warm transfer with context:", call)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Calls</h2>
          <p className="text-muted-foreground">
            View and manage all your call records
          </p>
        </div>
      </div>

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

      {/* Calls Table */}
      <div className="border rounded-lg">
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
      </div>

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