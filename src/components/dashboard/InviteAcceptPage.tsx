/**
 * @deprecated This component is deprecated and should NOT be used.
 * Use the main invite acceptance page at `/invite/accept` instead,
 * which is implemented in `src/pages/InviteAccept.tsx`.
 * 
 * This component had a broken implementation that only updated the
 * invitation status without creating the organization membership.
 * 
 * The correct flow uses:
 * - Edge function: `org-invitations-accept` (supabase/functions/org-invitations-accept/index.ts)
 * - Page component: `src/pages/InviteAccept.tsx`
 * 
 * DO NOT USE THIS COMPONENT IN PRODUCTION.
 */

import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

/**
 * @deprecated Redirects to the canonical invite accept page.
 * This component should not be rendered directly - use /invite/accept route.
 */
export function InviteAcceptPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    // Redirect to the canonical invite acceptance page
    const redirectPath = token 
      ? `/invite/accept?token=${encodeURIComponent(token)}`
      : '/invite/accept';
    
    console.warn(
      'InviteAcceptPage (dashboard component) is deprecated. ' +
      'Redirecting to the canonical invite acceptance page at /invite/accept'
    );
    
    navigate(redirectPath, { replace: true });
  }, [navigate, token]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">Redirecting to invitation page...</p>
      </div>
    </div>
  );
}

// Export default for backwards compatibility
export default InviteAcceptPage;
