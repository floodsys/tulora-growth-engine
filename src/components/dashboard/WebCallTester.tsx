import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TestTube, Phone, PhoneCall, StopCircle, Mic, MicOff } from 'lucide-react'
import { useRetellAgents } from '@/hooks/useRetellAgents'
import { useWebCalls } from '@/hooks/useWebCalls'
import { useUserOrganization } from '@/hooks/useUserOrganization'
import { useToast } from '@/hooks/use-toast'

export const WebCallTester = () => {
  const { organization } = useUserOrganization()
  const { agents } = useRetellAgents(organization?.id)
  const { createWebCall, isConnected, isCallActive, connect, disconnect, startCall, endCall } = useWebCalls()
  const { toast } = useToast()

  const [selectedAgent, setSelectedAgent] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [callTimer, setCallTimer] = useState<NodeJS.Timeout | null>(null)

  const publishedAgents = agents?.filter(agent => agent.status === 'published') || []

  const handleStartCall = async () => {
    if (!selectedAgent) {
      toast({
        title: "No agent selected",
        description: "Please select an agent to test.",
        variant: "destructive"
      })
      return
    }

    try {
      const agent = agents?.find(a => a.id === selectedAgent)
      if (!agent) return

      await createWebCall(agent.agent_id)
      await startCall()
      
      // Start call timer
      const timer = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
      setCallTimer(timer)

      toast({
        title: "Call started",
        description: "Web call has been initiated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start web call.",
        variant: "destructive"
      })
    }
  }

  const handleEndCall = async () => {
    try {
      await endCall()
      
      // Clear timer
      if (callTimer) {
        clearInterval(callTimer)
        setCallTimer(null)
      }
      setCallDuration(0)

      toast({
        title: "Call ended",
        description: "Web call has been ended.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to end call.",
        variant: "destructive"
      })
    }
  }

  const handleToggleMute = () => {
    setIsMuted(!isMuted)
    // TODO: Implement actual mute functionality
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getConnectionStatus = () => {
    if (isCallActive) return { status: 'On Call', color: 'bg-green-500' }
    if (isConnected) return { status: 'Connected', color: 'bg-blue-500' }
    return { status: 'Disconnected', color: 'bg-gray-500' }
  }

  const connectionStatus = getConnectionStatus()

  return (
    <div className="space-y-6">
      {/* Test Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Web Call Testing
          </CardTitle>
          <CardDescription>
            Test your agents with one-click web calls directly in your browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Agent Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Agent to Test</label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an agent" />
              </SelectTrigger>
              <SelectContent>
                {publishedAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <span>{agent.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {agent.language}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {publishedAgents.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No published agents available. Publish an agent first to test it.
              </p>
            )}
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${connectionStatus.color}`} />
              <span className="text-sm font-medium">{connectionStatus.status}</span>
            </div>
            {isCallActive && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono">{formatDuration(callDuration)}</span>
              </div>
            )}
          </div>

          {/* Call Controls */}
          <div className="flex gap-4">
            {!isCallActive ? (
              <Button 
                onClick={handleStartCall}
                disabled={!selectedAgent || !publishedAgents.length}
                className="flex items-center gap-2"
              >
                <PhoneCall className="h-4 w-4" />
                Start Call
              </Button>
            ) : (
              <Button 
                onClick={handleEndCall}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <StopCircle className="h-4 w-4" />
                End Call
              </Button>
            )}

            {isCallActive && (
              <Button 
                onClick={handleToggleMute}
                variant="outline"
                className="flex items-center gap-2"
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>
            )}
          </div>

          {/* Call Status Display */}
          {isCallActive && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <Phone className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Call Active</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Testing agent: {agents?.find(a => a.id === selectedAgent)?.name}
                  </p>
                  <div className="text-2xl font-mono font-bold">
                    {formatDuration(callDuration)}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">How to test your agents:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Select a published agent from the dropdown</li>
              <li>Click "Start Call" to initiate a web call</li>
              <li>Allow microphone access when prompted</li>
              <li>Speak naturally to test the agent's responses</li>
              <li>Use the mute button to control your microphone</li>
              <li>Click "End Call" when finished testing</li>
            </ol>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">What to test:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Voice clarity and response time</li>
              <li>Knowledge base integration</li>
              <li>Conversation flow and context handling</li>
              <li>Transfer capabilities (if configured)</li>
              <li>End-of-call behavior</li>
            </ul>
          </div>

          <div className="bg-blue-50 p-4 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Test calls will appear in your call history and may count toward your usage limits.
              Use this feature responsibly for testing and quality assurance.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recent Test Calls */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Test Calls</CardTitle>
          <CardDescription>
            View your recent test calls and their results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Recent test calls will appear here
          </div>
        </CardContent>
      </Card>
    </div>
  )
}