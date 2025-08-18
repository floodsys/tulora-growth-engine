import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Play, Phone } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Call {
  id: string
  caller: string
  outcome: string
  sentiment: "positive" | "neutral" | "negative"
  duration: number
  owner: string
  timestamp: Date
}

interface RecentCallsTableProps {
  calls: Call[]
  loading?: boolean
  onCallSelect?: (call: Call) => void
  onRedial?: (call: Call) => void
}

export function RecentCallsTable({ calls, loading, onCallSelect, onRedial }: RecentCallsTableProps) {
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Calls</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Caller</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Sentiment</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calls.map((call) => (
              <TableRow 
                key={call.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onCallSelect?.(call)}
              >
                <TableCell className="font-medium">{call.caller}</TableCell>
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
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        onCallSelect?.(call)
                      }}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRedial?.(call)
                      }}
                    >
                      <Phone className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}