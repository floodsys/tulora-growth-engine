import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Monitor, Loader2, AlertTriangle } from "lucide-react"
import { useRetellWebCall } from "@/hooks/useRetellWebCall"
import { BrowserCallModal } from "@/components/BrowserCallModal"
import { Link } from "react-router-dom"

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
  const { loading, session, billingLimitError, isDisabled, createWebCall, endWebCall, clearBillingError } = useRetellWebCall()

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
      <div className="flex flex-col gap-2">
        {/* Billing Limit Error Alert */}
        {billingLimitError.isOverLimit && (
          <Alert variant="destructive" className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800 dark:text-orange-200 text-xs">
              You've hit your plan's call limit.{" "}
              <Link to="/dashboard?screen=billing" className="underline font-medium hover:text-orange-900">
                Update plan
              </Link>
            </AlertDescription>
          </Alert>
        )}
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleStartWebCall}
          disabled={loading || isDisabled()}
          className={`flex-1 ${className}`}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Monitor className="h-4 w-4 mr-2" />
          )}
          Test in Browser
        </Button>
      </div>

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
