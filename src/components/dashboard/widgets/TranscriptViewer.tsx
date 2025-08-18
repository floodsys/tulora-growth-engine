import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { User, Bot } from "lucide-react"

interface TranscriptSegment {
  id: string
  speaker: "user" | "agent"
  text: string
  timestamp: string
  confidence?: number
}

interface TranscriptViewerProps {
  segments: TranscriptSegment[]
  title?: string
}

export function TranscriptViewer({ segments, title = "Call Transcript" }: TranscriptViewerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full">
          <div className="space-y-4">
            {segments.map((segment) => (
              <div key={segment.id} className="flex gap-3">
                <div className="flex-shrink-0">
                  {segment.speaker === "user" ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <User className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {segment.speaker === "user" ? "Customer" : "Agent"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {segment.timestamp}
                    </span>
                    {segment.confidence && (
                      <Badge variant="outline" className="text-xs">
                        {Math.round(segment.confidence * 100)}% confidence
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-sm text-foreground bg-muted/50 rounded-lg p-3">
                    {segment.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}