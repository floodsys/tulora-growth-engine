import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Crown, CreditCard } from "lucide-react"
import { startCheckout } from "@/lib/billing-hooks"

interface BillingTestPanelProps {
  currentOrgId: string
  billingStatus: any
  onRefresh: () => void
}

export function BillingTestPanel({ currentOrgId, billingStatus, onRefresh }: BillingTestPanelProps) {
  const [isTestingCheckout, setIsTestingCheckout] = React.useState(false)

  const handleTestCheckout = async (interval: 'month' | 'year') => {
    try {
      setIsTestingCheckout(true)
      console.log('Testing checkout with:', { orgId: currentOrgId, interval, seats: 1 })
      
      const result = await startCheckout(currentOrgId, interval, 1)
      if (result.success) {
        setTimeout(() => {
          onRefresh() // Refresh billing status after checkout
        }, 2000)
      }
    } catch (error) {
      console.error('Test checkout error:', error)
    } finally {
      setIsTestingCheckout(false)
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
            <span className="font-medium">Price ID:</span>
            <span className="ml-2 text-xs">{billingStatus?.price_id || 'none'}</span>
          </div>
          <div>
            <span className="font-medium">Plan Key:</span>
            <span className="ml-2">{billingStatus?.plan_key || 'none'}</span>
          </div>
        </div>

        {/* Test Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => handleTestCheckout('month')}
            disabled={isTestingCheckout}
          >
            <CreditCard className="h-3 w-3 mr-1" />
            Test Monthly Checkout
          </Button>
          
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => handleTestCheckout('year')}
            disabled={isTestingCheckout}
          >
            <Crown className="h-3 w-3 mr-1" />
            Test Yearly Checkout
          </Button>
          
          <Button 
            size="sm" 
            variant="outline"
            onClick={onRefresh}
          >
            Refresh Status
          </Button>
        </div>

        {/* Debug Info */}
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-yellow-700">
            Debug Info
          </summary>
          <pre className="mt-2 p-2 bg-yellow-100 rounded text-yellow-800 overflow-auto">
            {JSON.stringify({
              orgId: currentOrgId,
              billingStatus,
              timestamp: new Date().toISOString()
            }, null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  )
}