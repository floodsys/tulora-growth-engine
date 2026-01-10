import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Phone, Loader2, AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useRetellWebCall } from "@/hooks/useRetellWebCall"
import { useToast } from "@/hooks/use-toast"
import { Link } from "react-router-dom"

interface PhoneCallTesterProps {
  agent: {
    agent_id: string
    name: string
    status: string
  }
  className?: string
}

export function PhoneCallTester({ agent, className = "" }: PhoneCallTesterProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [calling, setCalling] = useState(false)
  const [billingLimitError, setBillingLimitError] = useState<boolean>(false)
  const [buttonDisabledUntil, setButtonDisabledUntil] = useState<number>(0)
  const { toast } = useToast()

  // Check if error is a BILLING_OVER_LIMIT error
  const isBillingOverLimit = (data: any): boolean => {
    return data?.code === 'BILLING_OVER_LIMIT'
  }

  // Check if error is a BILLING_QUOTA_CHECK_ERROR (transient usage verification failure)
  const isBillingQuotaCheckError = (data: any): boolean => {
    return data?.code === 'BILLING_QUOTA_CHECK_ERROR'
  }

  // Temporarily disable button after billing error
  const disableButtonTemporarily = () => {
    setButtonDisabledUntil(Date.now() + 5000) // 5 second cooldown
    setTimeout(() => setButtonDisabledUntil(0), 5000)
  }

  const isButtonDisabled = () => Date.now() < buttonDisabledUntil

  const handleMakeCall = async () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a phone number",
        variant: "destructive"
      })
      return
    }

    try {
      setCalling(true)

      // Call the dial-outbound edge function
      const response = await fetch('/api/retell-dial-outbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          agentId: agent.agent_id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Check for billing limit error
        if (isBillingOverLimit(data)) {
          setBillingLimitError(true)
          disableButtonTemporarily()
          toast({
            title: "Call Limit Reached",
            description: "You've hit your plan's call limit for this month. Update your plan in Billing to continue.",
            variant: "destructive"
          })
          return
        }
        // Check for transient quota check error
        if (isBillingQuotaCheckError(data)) {
          setBillingLimitError(false)
          toast({
            title: "Please try again",
            description: "We're temporarily unable to verify your usage. Please try again in a moment.",
            variant: "default"
          })
          return
        }
        throw new Error(data.error || 'Failed to initiate call')
      }

      setBillingLimitError(false)
      toast({
        title: "Call Initiated",
        description: `Outbound call to ${phoneNumber} has been started`,
      })

      setDialogOpen(false)
      setPhoneNumber("")

    } catch (error: any) {
      console.error('Error making test call:', error)
      toast({
        title: "Call Failed",
        description: error.message || "Failed to initiate test call",
        variant: "destructive"
      })
    } finally {
      setCalling(false)
    }
  }

  if (agent.status !== 'published') {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className={`flex-1 ${className}`}
      >
        <Phone className="h-4 w-4 mr-2" />
        Test Call
        <Badge variant="secondary" className="ml-2 text-xs">
          Requires published agent
        </Badge>
      </Button>
    )
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`flex-1 ${className}`}
        >
          <Phone className="h-4 w-4 mr-2" />
          Test Call
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test Phone Call</DialogTitle>
          <DialogDescription>
            Make a test call using {agent.name} to verify your agent setup
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              placeholder="+1 (555) 123-4567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Include country code (e.g., +1 for US numbers)
            </p>
          </div>

          {/* Billing Limit Error Alert */}
          {billingLimitError && (
            <Alert variant="destructive" className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800 dark:text-orange-200">
                You've hit your plan's call limit for this month.{" "}
                <Link to="/dashboard?screen=billing" className="underline font-medium hover:text-orange-900">
                  Update your plan in Billing
                </Link>{" "}
                to continue.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={calling}
            >
              Cancel
            </Button>
            <Button onClick={handleMakeCall} disabled={calling || !phoneNumber.trim() || isButtonDisabled()}>
              {calling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calling...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  Make Call
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
