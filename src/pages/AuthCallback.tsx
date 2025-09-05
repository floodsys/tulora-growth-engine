import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isProfileComplete } from "@/lib/profile/isProfileComplete";
import { Loader2 } from "lucide-react";
import logo from "@/assets/logo.svg";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("Completing sign in...");

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        setStatus("Verifying authentication...");
        
        // Handle the auth callback from Supabase
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          setStatus("Authentication failed. Redirecting...");
          setTimeout(() => navigate('/auth'), 2000);
          return;
        }

        if (!data.session || !data.session.user) {
          setStatus("No session found. Redirecting...");
          setTimeout(() => navigate('/auth'), 1000);
          return;
        }

        const user = data.session.user;
        setStatus("Checking profile...");

        // Check if user's profile has required organization fields
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('organization_name, organization_size, industry')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Profile fetch error:', profileError);
          // Continue to dashboard if we can't check profile
          setStatus("Completing setup...");
          setTimeout(() => navigate('/dashboard'), 1000);
          return;
        }

         // Check if profile is complete using centralized function
         if (!isProfileComplete(profile)) {
          setStatus("Setting up your profile...");
          const nextUrl = searchParams.get('next') || '/dashboard';
          setTimeout(() => navigate(`/onboarding/organization?next=${encodeURIComponent(nextUrl)}`), 1000);
        } else {
          setStatus("Welcome back! Redirecting...");
          const nextUrl = searchParams.get('next') || '/dashboard';
          setTimeout(() => navigate(nextUrl), 1000);
        }

      } catch (error) {
        console.error('Unexpected error in auth callback:', error);
        setStatus("Something went wrong. Redirecting...");
        setTimeout(() => navigate('/auth'), 2000);
      } finally {
        setIsLoading(false);
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-6 p-8">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={logo} alt="Tulora" className="h-12 w-auto" />
        </div>

        {/* Loading spinner */}
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>

        {/* Status message */}
        <p className="text-muted-foreground text-lg">
          {status}
        </p>

        {/* Loading indicator */}
        <div className="w-64 mx-auto">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;