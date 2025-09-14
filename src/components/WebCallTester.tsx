import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Monitor, Loader2 } from "lucide-react"
import { useRetellWebCall } from "@/hooks/useRetellWebCall"
import { BrowserCallModal } from "@/components/BrowserCallModal"

interface WebCallTesterProps {
  agent: {
    agent_id: string
    name: string
    status: string
  }
  className?: string
}

export function WebCallTester({ agent, className = "" }: WebCallTesterProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [traceId, setTraceId] = useState<string>()
  const { loading, session, createWebCall, endWebCall } = useRetellWebCall()

  const handleStartWebCall = async () => {
    const sessionData = await createWebCall(agent.agent_id)
    if (sessionData) {
      setTraceId(`trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
      setModalOpen(true)
    }
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    endWebCall()
    setTraceId(undefined)
  }

  if (agent.status !== 'published') {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        disabled 
        className={`flex-1 ${className}`}
      >
        <Monitor className="h-4 w-4 mr-2" />
        Test in Browser
        <Badge variant="secondary" className="ml-2 text-xs">
          Requires published agent
        </Badge>
      </Button>
    )
  }

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleStartWebCall}
        disabled={loading}
        className={`flex-1 ${className}`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Monitor className="h-4 w-4 mr-2" />
        )}
        Test in Browser
      </Button>

      <BrowserCallModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        sessionData={session}
        traceId={traceId}
        agentName={agent.name}
      />
    </>
  )
}