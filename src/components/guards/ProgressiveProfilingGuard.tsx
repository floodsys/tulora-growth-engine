import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProgressiveProfilingGuardProps {
  children: React.ReactNode;
}

const ProgressiveProfilingGuard = ({ children }: ProgressiveProfilingGuardProps) => {
  const [isChecking, setIsChecking] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Routes that should be exempt from profile checking
  const exemptRoutes = [
    '/auth',
    '/auth/callback',
    '/onboarding/organization',
    '/invite/accept',
    '/invite/accept-new',
    '/demo',
    '/demos/voice',
    '/complete-profile',
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

        // Check if user's profile has required organization fields
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('organization_name, organization_size, industry')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Profile check error (non-PII details):', {
            error_message: profileError.message,
            error_code: profileError.code,
            timestamp: new Date().toISOString(),
          });
          // Allow access if we can't check profile
          setIsChecking(false);
          return;
        }

        // Check if any required org fields are missing or empty
        const isProfileIncomplete = !profile || 
          !profile.organization_name?.trim() || 
          !profile.organization_size?.trim() || 
          !profile.industry?.trim();

        if (isProfileIncomplete) {
          // Redirect to onboarding with current path as next parameter
          const currentPath = location.pathname + location.search;
          navigate(`/onboarding/organization?next=${encodeURIComponent(currentPath)}`);
          return;
        }

        // Profile is complete, allow access
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
  }, [location.pathname, navigate]);

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