import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

/**
 * Redirect component that handles the old invite acceptance route
 * Logs the redirect event and permanently redirects to the canonical route
 */
export const InviteAcceptRedirect = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  useEffect(() => {
    const token = searchParams.get('token');
    
    // Log the redirect event for audit purposes
    const logRedirect = async () => {
      try {
        await supabase.rpc('log_event', {
          p_org_id: '00000000-0000-0000-0000-000000000000',
          p_action: 'invite.accept_redirected',
          p_target_type: 'redirect',
          p_target_id: 'invite_accept_new',
          p_status: 'success',
          p_channel: 'internal',
          p_metadata: {
            old_route: '/invite/accept-new',
            new_route: '/invite/accept',
            token_present: !!token,
            redirect_type: '308_permanent',
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Failed to log redirect event:', error);
      }
    };

    // Log the redirect (fire and forget)
    logRedirect();

    // Perform the redirect with token preservation
    const newPath = token ? `/invite/accept?token=${encodeURIComponent(token)}` : '/invite/accept';
    
    // Use replace to avoid adding to history (simulates 308 redirect)
    navigate(newPath, { replace: true });
  }, [searchParams, navigate]);

  // Return null as this component only handles redirects
  return null;
};