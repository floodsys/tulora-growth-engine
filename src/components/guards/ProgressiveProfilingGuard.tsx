import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isProfileComplete } from "@/lib/profile/isProfileComplete";
import { resolveNextPath } from "@/lib/navigation/resolveNextPath";
import { useProfile } from "@/hooks/useProfile";
import { Loader2 } from "lucide-react";

interface ProgressiveProfilingGuardProps {
  children: React.ReactNode;
}

const ProgressiveProfilingGuard = ({ children }: ProgressiveProfilingGuardProps) => {
  const [isChecking, setIsChecking] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, isLoading: profileLoading } = useProfile();

  // Routes that should be exempt from profile checking
  const exemptRoutes = [
    '/auth',
    '/auth/callback',
    '/onboarding/organization',
    '/invite/accept',
    '/invite/accept-new',
    '/demo',
    '/demos/voice',
    '/', // Allow access to landing page
  ];

  useEffect(() => {
    const checkProfileCompleteness = async () => {
      try {
        // Skip check for exempt routes
        if (exemptRoutes.some(route => location.pathname.startsWith(route))) {
          setIsChecking(false);
          return;
        }

        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        // If no session, let the page render (other auth guards will handle it)
        if (!session) {
          setIsChecking(false);
          return;
        }

        // Wait for profile to load from cache
        if (profileLoading) {
          return; // Will re-run when profileLoading changes
        }

        // ================================================================
        // FULL ONBOARDING CHECK: User must have BOTH:
        // 1. Profile complete (organization_name, organization_size, industry)
        // 2. current_org_id set (user is associated with an organization)
        // 
        // NOTE: When multi-org switching is introduced, the current_org_id
        // check may need to be moved to a separate org-context guard.
        // ================================================================

        // Step 1: Check if basic profile fields are complete
        if (!isProfileComplete(profile)) {
          // Loop protection: don't redirect if already on onboarding
          if (location.pathname.startsWith('/onboarding/organization')) {
            setIsChecking(false);
            return;
          }
          
          // Redirect to onboarding with current path as next parameter
          const currentPath = location.pathname + location.search;
          const safeNext = resolveNextPath(currentPath);
          navigate(`/onboarding/organization?next=${encodeURIComponent(safeNext)}`, { replace: true });
          return;
        }

        // Step 2: Check if user has an organization assigned
        // This ensures the user completed org creation/selection after profile fields
        if (!profile?.current_org_id) {
          // Loop protection: don't redirect if already on onboarding
          if (location.pathname.startsWith('/onboarding/organization')) {
            setIsChecking(false);
            return;
          }
          
          // Profile is complete but no org assigned - redirect to org onboarding
          const currentPath = location.pathname + location.search;
          const safeNext = resolveNextPath(currentPath);
          navigate(`/onboarding/organization?next=${encodeURIComponent(safeNext)}`, { replace: true });
          return;
        }

        // Both profile complete AND current_org_id set - allow dashboard access
        setIsChecking(false);

      } catch (error: any) {
        console.error('Progressive profiling guard error (non-PII details):', {
          error_message: error.message,
          timestamp: new Date().toISOString(),
        });
        // Allow access if there's an unexpected error
        setIsChecking(false);
      }
    };

    checkProfileCompleteness();
  }, [location.pathname, navigate, profile, profileLoading]);

  // Show loading spinner while checking
  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProgressiveProfilingGuard;
