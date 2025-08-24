import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Users, ArrowRight, Loader2, AlertTriangle } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"

interface SeatSyncData {
  organizationId: string
  organizationName: string
  currentQuantity: number
  currentSeats: number
  hasSubscription: boolean
}

interface SeatSyncDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  data: SeatSyncData | null
}

export function SeatSyncDialog({ isOpen, onClose, onConfirm, data }: SeatSyncDialogProps) {
  const [isSyncing, setIsSyncing] = useState(false)

  if (!data) return null

  const needsSync = data.currentQuantity !== data.currentSeats
  const diff = data.currentSeats - data.currentQuantity

  const handleConfirm = async () => {
    if (!needsSync) {
      toast({
        title: "No sync needed",
        description: "Seat count is already up to date",
      })
      onClose()
      return
    }

    setIsSyncing(true)
    try {
      const { data: syncData, error } = await supabase.functions.invoke('org-update-seats', {
        body: { orgId: data.organizationId }
      })

      if (error) throw error

      toast({
        title: "Seats synced successfully",
        description: `Updated ${data.organizationName} from ${data.currentQuantity} to ${data.currentSeats} seats`,
      })
      
      onConfirm()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error syncing seats",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Recalculate Seats
          </DialogTitle>
          <DialogDescription>
            Sync seat count with Stripe subscription for {data.organizationName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current State */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Current State</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Stripe Quantity:</span>
                <Badge variant="outline">{data.currentQuantity} seats</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Members:</span>
                <Badge variant="outline">{data.currentSeats} seats</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Sync Preview */}
          {needsSync ? (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  Sync Required
                </CardTitle>
                <CardDescription>
                  Stripe quantity will be updated to match active members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {data.currentQuantity}
                    </div>
                    <div className="text-sm text-muted-foreground">Current</div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {data.currentSeats}
                    </div>
                    <div className="text-sm text-muted-foreground">New</div>
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">
                    Change: <span className={`font-medium ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {diff > 0 ? '+' : ''}{diff} seats
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-green-800">
                  ✓ Already in Sync
                </CardTitle>
                <CardDescription>
                  Stripe quantity matches active member count
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {!data.hasSubscription && (
            <Card className="border-gray-200 bg-gray-50">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground text-center">
                  No active subscription found. Seat sync will update database record only.
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSyncing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSyncing}>
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : needsSync ? (
              'Sync Seats'
            ) : (
              'Close'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}