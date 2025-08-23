import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"

/**
 * Automatically sync seats with Stripe after membership changes
 * This should be called after:
 * - Invite acceptance
 * - Member removal
 * - seat_active toggling
 */
export async function triggerSeatSync(orgId: string, options?: { showToast?: boolean }) {
  try {
    const { data, error } = await supabase.functions.invoke('org-update-seats', {
      body: { orgId }
    })

    if (error) throw error

    if (options?.showToast) {
      toast({
        title: "Seats synced",
        description: data.message || "Subscription updated successfully",
      })
    }

    return { success: true, data }
  } catch (error: any) {
    console.error('Error syncing seats:', error)
    
    if (options?.showToast) {
      toast({
        title: "Seat sync failed",
        description: error.message || "Failed to sync subscription",
        variant: "destructive",
      })
    }
    
    return { success: false, error }
  }
}

/**
 * Start a checkout session for upgrading to Pro
 */
export async function startCheckout(orgId: string, interval: 'month' | 'year', seats: number) {
  try {
    const { data, error } = await supabase.functions.invoke('create-org-checkout', {
      body: { 
        orgId,
        interval,
        seats
      }
    })

    if (error) throw error

    // Open Stripe Checkout in new tab
    window.open(data.url, '_blank')
    
    toast({
      title: "Redirecting to checkout",
      description: `Opening ${interval}ly plan checkout...`,
    })

    return { success: true, data }
  } catch (error: any) {
    toast({
      title: "Error starting checkout",
      description: error.message || "Failed to start checkout process",
      variant: "destructive",
    })
    return { success: false, error }
  }
}

/**
 * Accept an organization invitation and sync seats
 */
export async function acceptInvitation(membershipId: string, orgId: string) {
  try {
    // Update membership status to active
    const { error: updateError } = await supabase
      .from('memberships')
      .update({ status: 'active' })
      .eq('id', membershipId)

    if (updateError) throw updateError

    // Add to organization_members if not exists
    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      const { error: memberError } = await supabase
        .from('organization_members')
        .upsert({
          org_id: orgId,
          user_id: userData.user.id,
          seat_active: true,
          role: 'member'
        }, {
          onConflict: 'org_id,user_id'
        })

      if (memberError) throw memberError
    }

    // Auto-sync seats
    await triggerSeatSync(orgId)

    toast({
      title: "Invitation accepted",
      description: "You've been added to the organization",
    })

    return { success: true }
  } catch (error: any) {
    toast({
      title: "Error accepting invitation",
      description: error.message,
      variant: "destructive",
    })
    return { success: false, error }
  }
}

/**
 * Remove a member from organization and sync seats
 */
export async function removeMember(userId: string, orgId: string) {
  try {
    // Remove from organization_members
    const { error: removeError } = await supabase
      .from('organization_members')
      .delete()
      .eq('org_id', orgId)
      .eq('user_id', userId)

    if (removeError) throw removeError

    // Update membership status to removed
    const { error: statusError } = await supabase
      .from('memberships')
      .update({ status: 'removed' })
      .eq('organization_id', orgId)
      .eq('user_id', userId)

    if (statusError) throw statusError

    // Auto-sync seats
    await triggerSeatSync(orgId)

    toast({
      title: "Member removed",
      description: "Member has been removed from the organization",
    })

    return { success: true }
  } catch (error: any) {
    toast({
      title: "Error removing member",
      description: error.message,
      variant: "destructive",
    })
    return { success: false, error }
  }
}

/**
 * Toggle seat active status and sync seats
 */
export async function toggleSeatActive(userId: string, orgId: string, seatActive: boolean) {
  try {
    const { error } = await supabase
      .from('organization_members')
      .update({ seat_active: seatActive })
      .eq('org_id', orgId)
      .eq('user_id', userId)

    if (error) throw error

    // Auto-sync seats
    await triggerSeatSync(orgId)

    toast({
      title: seatActive ? "Seat activated" : "Seat deactivated",
      description: `Member's seat has been ${seatActive ? 'activated' : 'deactivated'}`,
    })

    return { success: true }
  } catch (error: any) {
    toast({
      title: "Error updating seat",
      description: error.message,
      variant: "destructive",
    })
    return { success: false, error }
  }
}