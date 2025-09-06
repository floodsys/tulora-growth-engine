import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, Crown, CreditCard, RefreshCw } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface BillingTestPanelProps {
  currentOrgId: string
  billingStatus: any
  onRefresh: () => void
}

const planOptions = [
  { value: 'leadgen_starter', label: 'Lead Gen - Starter ($2,500/mo)', category: 'Lead Gen' },
  { value: 'leadgen_business', label: 'Lead Gen - Business ($3,500/mo)', category: 'Lead Gen' },
  { value: 'support_starter', label: 'Support - Starter ($1,500/mo)', category: 'Support' },
  { value: 'support_business', label: 'Support - Business ($3,500/mo)', category: 'Support' },
]

export function BillingTestPanel({ currentOrgId, billingStatus, onRefresh }: BillingTestPanelProps) {
  const [isTestingCheckout, setIsTestingCheckout] = React.useState(false)
  const [isSyncingSeats, setIsSyncingSeats] = React.useState(false)
  const [selectedPlan, setSelectedPlan] = React.useState<string>('leadgen_starter')
  const { toast } = useToast()

  const handleTestCheckout = async () => {
    try {
      setIsTestingCheckout(true)
      console.log('Testing checkout with:', { 
        orgId: currentOrgId, 
        planKey: selectedPlan, 
        interval: 'monthly', 
        seats: 1 
      })
      
      const { data, error } = await supabase.functions.invoke('create-org-checkout', {
        body: {
          orgId: currentOrgId,
          planKey: selectedPlan,
          interval: 'monthly',
          seats: 1
        }
      })

      if (error) throw error

      // Open Stripe Checkout in new tab
      window.open(data.url, '_blank')
      
      toast({
        title: "Test Checkout Started",
        description: `Opening ${selectedPlan} checkout in new tab...`,
      })

      setTimeout(() => {
        onRefresh() // Refresh billing status after checkout
      }, 2000)
    } catch (error: any) {
      console.error('Test checkout error:', error)
      toast({
        title: "Test Checkout Error",
        description: error.message || "Failed to start test checkout",
        variant: "destructive",
      })
    } finally {
      setIsTestingCheckout(false)
    }
  }

  const handleSyncSeats = async () => {
    try {
      setIsSyncingSeats(true)
      
      const { data, error } = await supabase.functions.invoke('org-update-seats', {
        body: { orgId: currentOrgId }
      })

      if (error) throw error

      toast({
        title: "Seats Synced",
        description: data.message || "Seats synchronized successfully",
      })
      
      onRefresh()
    } catch (error: any) {
      console.error('Sync seats error:', error)
      toast({
        title: "Sync Error",
        description: error.message || "Failed to sync seats",
        variant: "destructive",
      })
    } finally {
      setIsSyncingSeats(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'trialing': return 'bg-blue-500'
      case 'past_due': return 'bg-yellow-500'
      case 'canceled':
      case 'inactive':
      default: return 'bg-gray-500'
    }
  }

  const selectedPlanInfo = planOptions.find(p => p.value === selectedPlan)

  return (
    <Card className="border-dashed border-2 border-yellow-300 bg-yellow-50">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-yellow-800">
          🧪 Billing Test Panel (Development)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status Display */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Status:</span>
            <Badge className={`ml-2 ${getStatusColor(billingStatus?.billing_status || 'inactive')}`}>
              {billingStatus?.billing_status || 'inactive'}
            </Badge>
          </div>
          <div>
            <span className="font-medium">Seats:</span>
            <span className="ml-2">{billingStatus?.quantity || 0}</span>
          </div>
          <div>
            <span className="font-medium">Plan Key:</span>
            <span className="ml-2">{billingStatus?.plan_key || 'none'}</span>
          </div>
          <div>
            <span className="font-medium">Billing Tier:</span>
            <span className="ml-2">{billingStatus?.billing_tier || 'none'}</span>
          </div>
        </div>

        {/* Plan Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-yellow-800">Test Plan:</label>
          <Select value={selectedPlan} onValueChange={setSelectedPlan}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Select a plan to test" />
            </SelectTrigger>
            <SelectContent>
              {planOptions.map((plan) => (
                <SelectItem key={plan.value} value={plan.value}>
                  <div className="flex flex-col">
                    <span>{plan.label}</span>
                    <span className="text-xs text-muted-foreground">{plan.category}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPlanInfo && (
            <p className="text-xs text-yellow-700">
              Selected: <strong>{selectedPlanInfo.label}</strong>
            </p>
          )}
        </div>

        {/* Test Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleTestCheckout}
            disabled={isTestingCheckout}
            className="bg-white hover:bg-yellow-100"
          >
            <CreditCard className="h-3 w-3 mr-1" />
            {isTestingCheckout ? 'Starting...' : 'Start Checkout'}
          </Button>
          
          <Button 
            size="sm" 
            variant="outline"
            onClick={onRefresh}
            className="bg-white hover:bg-yellow-100"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh Status
          </Button>

          <Button 
            size="sm" 
            variant="outline"
            onClick={handleSyncSeats}
            disabled={isSyncingSeats}
            className="bg-white hover:bg-yellow-100"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isSyncingSeats ? 'animate-spin' : ''}`} />
            {isSyncingSeats ? 'Syncing...' : 'Sync Seats'}
          </Button>
        </div>

        {/* Debug Info */}
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-yellow-700">
            Debug Info
          </summary>
          <pre className="mt-2 p-2 bg-yellow-100 rounded text-yellow-800 overflow-auto max-h-40">
            {JSON.stringify({
              orgId: currentOrgId,
              selectedPlan,
              billingStatus,
              timestamp: new Date().toISOString()
            }, null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  )
}