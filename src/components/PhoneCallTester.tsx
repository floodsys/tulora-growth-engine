import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Phone, Loader2 } from "lucide-react"
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
  const { toast } = useToast()

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
        throw new Error(data.error || 'Failed to initiate call')
      }

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
          
          <div className="flex justify-end space-x-3">
            <Button 
              variant="outline" 
              onClick={() => setDialogOpen(false)}
              disabled={calling}
            >
              Cancel
            </Button>
            <Button onClick={handleMakeCall} disabled={calling || !phoneNumber.trim()}>
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