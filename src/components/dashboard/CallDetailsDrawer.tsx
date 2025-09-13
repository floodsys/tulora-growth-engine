import React, { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { 
  Phone, 
  Play, 
  Download,
  Clock,
  User,
  TrendingUp,
  TrendingDown,
  Minus,
  Tag,
  FileText,
  Calendar,
  MapPin,
  Volume2
} from "lucide-react"
import { format } from "date-fns"
import { type RetellCall } from "@/hooks/useRetellCalls"
import { cn } from "@/lib/utils"

interface CallDetailsDrawerProps {
  call: RetellCall | null
  callDetails: any
  loading: boolean
  onClose: () => void
}

export const CallDetailsDrawer: React.FC<CallDetailsDrawerProps> = ({
  call,
  callDetails,
  loading,
  onClose
}) => {
  const [newTag, setNewTag] = useState("")

  if (!call) return null

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

  const getOutcomeIcon = (outcome?: string) => {
    switch (outcome) {
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      case 'neutral':
        return <Minus className="h-4 w-4 text-gray-600" />
      default:
        return null
    }
  }

  const playAudio = (url: string) => {
    const audio = new Audio(url)
    audio.play().catch(console.error)
  }

  return (
    <Sheet open={!!call} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle className="flex items-center">
            <Phone className="h-5 w-5 mr-2" />
            Call Details
          </SheetTitle>
          <SheetDescription>
            Call ID: {call.call_id}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          <div className="space-y-6">
            
            {/* Call Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Call Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Direction</Label>
                    <div className="flex items-center mt-1">
                      <Badge variant={call.direction === 'inbound' ? 'default' : 'secondary'}>
                        {call.direction}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-muted-foreground">Status</Label>
                    <div className="flex items-center mt-1">
                      <Badge variant={call.status === 'completed' ? 'default' : 'secondary'}>
                        {call.status}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-muted-foreground">Phone Number</Label>
                    <div className="font-medium mt-1">
                      {formatPhoneNumber(call.direction === 'inbound' ? call.from_e164 : call.to_e164)}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-muted-foreground">Duration</Label>
                    <div className="flex items-center mt-1">
                      <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                      {formatDuration(call.duration_ms)}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-muted-foreground">Started</Label>
                    <div className="flex items-center mt-1">
                      <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                      {call.started_at ? format(new Date(call.started_at), "MMM dd, yyyy HH:mm") : 'N/A'}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-muted-foreground">Agent</Label>
                    <div className="flex items-center mt-1">
                      <User className="h-4 w-4 mr-1 text-muted-foreground" />
                      {call.retell_agents?.name || call.agent_id || 'Unknown'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Analysis Results */}
            {(call.outcome || call.sentiment || call.lead_score !== null) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Analysis Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {call.outcome && (
                      <div>
                        <Label className="text-sm text-muted-foreground">Outcome</Label>
                        <div className="flex items-center mt-1">
                          {getOutcomeIcon(call.outcome)}
                          <span className="ml-2 font-medium capitalize">{call.outcome}</span>
                        </div>
                      </div>
                    )}
                    
                    {call.sentiment && (
                      <div>
                        <Label className="text-sm text-muted-foreground">Sentiment</Label>
                        <div className="font-medium mt-1 capitalize">{call.sentiment}</div>
                      </div>
                    )}
                    
                    {call.lead_score !== null && call.lead_score !== undefined && (
                      <div className="col-span-2">
                        <Label className="text-sm text-muted-foreground">Lead Score</Label>
                        <div className="flex items-center mt-2">
                          <div className="w-full h-3 bg-muted rounded-full mr-3">
                            <div 
                              className="h-3 bg-primary rounded-full transition-all duration-300" 
                              style={{ width: `${call.lead_score}%` }}
                            />
                          </div>
                          <span className="font-medium">{call.lead_score}/100</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Topics/Keywords */}
            {call.topics && call.topics.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Topics Discussed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {call.topics.map((topic, index) => (
                      <Badge key={index} variant="outline">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Call Timeline */}
            {callDetails?.timeline && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Call Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {callDetails.timeline.map((event: any, index: number) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium capitalize">
                              {event.event.replace('_', ' ')}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(event.timestamp), "HH:mm:ss")}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{event.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Transcript Summary */}
            {call.transcript_summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Transcript Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{call.transcript_summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Audio Recording */}
            {callDetails?.recording_url && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Volume2 className="h-5 w-5 mr-2" />
                    Call Recording
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => playAudio(callDetails.recording_url)}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Play Audio
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const link = document.createElement('a')
                        link.href = callDetails.recording_url
                        link.download = `call-${call.call_id}-recording.mp3`
                        link.click()
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Tag className="h-5 w-5 mr-2" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {call.tags && call.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {call.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <Input
                      placeholder="Add a tag..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newTag.trim()) {
                          // Add tag functionality would go here
                          setNewTag("")
                        }
                      }}
                    />
                    <Button 
                      size="sm" 
                      disabled={!newTag.trim()}
                      onClick={() => {
                        // Add tag functionality would go here
                        setNewTag("")
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Raw Data (for debugging) */}
            {callDetails?.raw_webhook_data && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Raw Webhook Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={JSON.stringify(callDetails.raw_webhook_data, null, 2)}
                    readOnly
                    className="font-mono text-xs"
                    rows={10}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}