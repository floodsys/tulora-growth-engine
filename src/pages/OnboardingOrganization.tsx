import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { saveOrganization, type OrganizationData } from "@/lib/profile/saveOrganization";
import { OrganizationStep, type OrganizationStepValues } from "@/components/onboarding/OrganizationStep";
import { resolveNextPath } from "@/lib/navigation/resolveNextPath";
import { useProfile } from "@/hooks/useProfile";
import { telemetry } from "@/lib/telemetry";
import { CheckCircle2, User, Mail, LogOut } from "lucide-react";
import logo from "@/assets/logo.svg";

const OnboardingOrganization = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [userInfo, setUserInfo] = useState({ name: "", email: "" });
  const [initialValues, setInitialValues] = useState<OrganizationStepValues>({
    organizationName: "",
    organizationSize: "",
    industry: "",
    customIndustry: "",
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, invalidateProfile } = useProfile();

  // Check authentication and get user info + set initial values from profile
  useEffect(() => {
    const checkAuthAndGetUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      // Get user info from auth metadata
      const user = session.user;
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || "";
      const email = user.email || "";
      
      setUserInfo({ name: fullName, email });
    };
    checkAuthAndGetUser();
  }, [navigate]);

  // Set initial values when profile data is available
  useEffect(() => {
    if (profile) {
      setInitialValues({
        organizationName: profile.organization_name || "",
        organizationSize: profile.organization_size || "",
        industry: profile.industry || "",
        customIndustry: "",
      });
    }
  }, [profile]);


  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (values: OrganizationStepValues) => {
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get full name from Google metadata if available and profile doesn't have it
      const fullName = (!profile?.full_name && userInfo.name) ? userInfo.name : undefined;

      // Prepare organization data
      const organizationData: OrganizationData = {
        organization_name: values.organizationName,
        organization_size: values.organizationSize,
        industry: values.industry === "Other" ? values.customIndustry : values.industry,
      };

      // Call the shared save function
      const result = await saveOrganization({
        userId: user.id,
        fullName,
        organizationData,
        source: 'onboarding',
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to save profile information');
      }

      // Track successful onboarding completion for Google users
      telemetry.signupStepCompleted('organization', 'google');

      // Invalidate profile cache so guards/components get fresh data
      invalidateProfile();

      // Show success toast with any auth metadata warnings
      if (result.authMetadataWarning) {
        toast({
          title: "Profile updated",
          description: result.authMetadataWarning,
          variant: "default",
        });
      } else {
        toast({
          title: "Profile updated",
          description: "Your organization information has been saved.",
        });
      }

      // Redirect to next URL or dashboard
      const nextParam = searchParams.get('next');
      const safeNext = resolveNextPath(nextParam);
      navigate(safeNext, { replace: true });

    } catch (error: any) {
      console.error('Profile completion error (non-PII details):', {
        error_message: error.message,
        timestamp: new Date().toISOString(),
        step: 'profile_completion'
      });
      
      toast({
        title: "Couldn't save profile. Please try again.",
        description: "There was an issue saving your information.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 max-w-md lg:max-w-lg mx-auto lg:mx-0">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-8">
            <Link to="/">
              <img src={logo} alt="Tulora" className="h-8 w-auto" />
            </Link>
          </div>
          
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Complete your profile
          </h1>
          <p className="text-muted-foreground">
            Tell us about your organization so we can tailor the experience.
          </p>

          {/* Progress indicator */}
          <div className="mt-6 mb-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-primary text-primary-foreground">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-foreground">Account</span>
              </div>
              <div className="flex-1 h-px bg-primary" />
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-primary text-primary-foreground">
                  2
                </div>
                <span className="text-sm font-medium text-foreground">Organization</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Info Section (Read-only) */}
        {(userInfo.name || userInfo.email) && (
          <div className="mb-6 p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span>Account Information</span>
            </div>
            {userInfo.name && (
              <div className="flex items-center space-x-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <Label className="text-xs text-muted-foreground">Full name</Label>
                  <p className="text-sm font-medium">{userInfo.name}</p>
                </div>
              </div>
            )}
            {userInfo.email && (
              <div className="flex items-center space-x-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p className="text-sm font-medium">{userInfo.email}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Organization Step */}
        <OrganizationStep
          initialValues={initialValues}
          onSubmit={handleSubmit}
          submitLabel="Save & continue"
          showBack={false}
          isLoading={isLoading}
        />
        
        {/* Sign out link */}
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center space-x-1"
          >
            <LogOut className="w-3 h-3" />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Right Panel - Optional illustration */}
      <div className="hidden lg:flex flex-1 bg-card items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-12 h-12 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">Almost there!</h3>
          <p className="text-muted-foreground max-w-sm">
            Just a few more details and you'll be ready to get started with your organization.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OnboardingOrganization;