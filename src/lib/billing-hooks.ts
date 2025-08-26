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
    console.log('Triggering seat sync for org:', orgId)
    
    const { data, error } = await supabase.functions.invoke('org-update-seats', {
      body: { orgId }
    })

    if (error) {
      console.error('Seat sync error:', error)
      throw error
    }

    console.log('Seat sync success:', data)

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
    console.log('Starting checkout:', { orgId, interval, seats })
    
    const { data, error } = await supabase.functions.invoke('create-org-checkout', {
      body: { 
        orgId,
        interval,
        seats
      }
    })

    if (error) {
      console.error('Checkout error:', error)
      throw error
    }

    console.log('Checkout response:', data)

    // Open Stripe Checkout in new tab
    if (data?.url) {
      window.open(data.url, '_blank')
      
      toast({
        title: "Redirecting to checkout",
        description: `Opening ${interval}ly plan checkout...`,
      })
    } else {
      throw new Error('No checkout URL returned')
    }

    return { success: true, data }
  } catch (error: any) {
    console.error('Checkout error details:', error)
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
export async function acceptInvitation(invitationToken: string) {
  try {
    // Use the canonical accept_invite function instead of direct table access
    const { data, error } = await supabase.rpc('accept_invite', { 
      p_token: invitationToken 
    });

    if (error) throw error;

    const result = data as any;
    if (!result?.success) {
      throw new Error(result?.error || 'Failed to accept invitation');
    }

    // Auto-sync seats with the organization from the response
    await triggerSeatSync(result.organization_id);

    toast({
      title: "Invitation accepted",
      description: "You've been added to the organization",
    });

    return { success: true, organizationId: result.organization_id };
  } catch (error: any) {
    toast({
      title: "Error accepting invitation",
      description: error.message,
      variant: "destructive",
    });
    return { success: false, error };
  }
}

/**
 * Remove a member from organization and sync seats
 */
export async function removeMember(userId: string, orgId: string) {
  try {
    // Use canonical admin_remove_member function instead of direct table access
    const { data, error } = await supabase.rpc('admin_remove_member', {
      p_organization_id: orgId,
      p_user_id: userId
    });

    if (error) throw error;

    const result = data as any;
    if (!result?.success) {
      throw new Error(result?.error || 'Failed to remove member');
    }

    // Auto-sync seats
    await triggerSeatSync(orgId);

    toast({
      title: "Member removed",
      description: "Member has been removed from the organization",
    });

    return { success: true };
  } catch (error: any) {
    toast({
      title: "Error removing member",
      description: error.message,
      variant: "destructive",
    });
    return { success: false, error };
  }
}

/**
 * Toggle seat active status and sync seats
 */
export async function toggleSeatActive(userId: string, orgId: string, seatActive: boolean) {
  try {
    // Use canonical admin_toggle_member_seat function
    const { data, error } = await supabase.rpc('admin_toggle_member_seat', {
      p_organization_id: orgId,
      p_user_id: userId,
      p_seat_active: seatActive
    });

    if (error) throw error;

    const result = data as any;
    if (!result?.success) {
      throw new Error(result?.error || 'Failed to toggle seat status');
    }

    // Auto-sync seats
    await triggerSeatSync(orgId);

    toast({
      title: seatActive ? "Seat activated" : "Seat deactivated",
      description: `Member's seat has been ${seatActive ? 'activated' : 'deactivated'}`,
    });

    return { success: true };
  } catch (error: any) {
    toast({
      title: "Error updating seat",
      description: error.message,
      variant: "destructive",
    });
    return { success: false, error };
  }
}