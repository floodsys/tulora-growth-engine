import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { safeProfileUpsert, splitFullName } from "@/lib/profileUtils";
import { CheckCircle2, User, Mail, LogOut } from "lucide-react";
import logo from "@/assets/logo.svg";

const OnboardingOrganization = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [userInfo, setUserInfo] = useState({ name: "", email: "" });
  const [formData, setFormData] = useState({
    organizationName: "",
    organizationSize: "",
    industry: "",
    customIndustry: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check authentication and get user info
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user makes selection
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.organizationName.trim()) {
      errors.organizationName = "Organization name is required";
    }
    if (!formData.organizationSize) {
      errors.organizationSize = "Organization size is required";
    }
    if (!formData.industry) {
      errors.industry = "Industry is required";
    }
    if (formData.industry === "Other" && !formData.customIndustry.trim()) {
      errors.customIndustry = "Please specify your industry";
    }
    
    setFormErrors(errors);
    
    // Focus first invalid field
    if (Object.keys(errors).length > 0) {
      const firstError = Object.keys(errors)[0];
      setTimeout(() => {
        const element = document.getElementById(firstError);
        if (element) element.focus();
      }, 100);
    }
    
    return Object.keys(errors).length === 0;
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get final industry value (use custom industry if "Other" was selected)
      const finalIndustry = formData.industry === "Other" ? formData.customIndustry : formData.industry;

      // Get full name from user info (from Google metadata)
      const fullName = userInfo.name || "";
      
      // Split full name into first and last name (only if we have a full name)
      let firstName = "";
      let lastName = "";
      if (fullName.trim()) {
        const nameResult = splitFullName(fullName);
        firstName = nameResult.firstName;
        lastName = nameResult.lastName;
      }

      // Check current profile to see what's missing
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('full_name, first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle();

      // Prepare profile data - only update name fields if they're missing in DB
      const profileData: any = {
        user_id: user.id,
        organization_name: formData.organizationName,
        organization_size: formData.organizationSize,
        industry: finalIndustry,
      };

      // Add name fields only if they're missing in existing profile
      if (!existingProfile?.full_name && fullName.trim()) {
        profileData.full_name = fullName;
      }
      if (!existingProfile?.first_name && firstName) {
        profileData.first_name = firstName;
      }
      if (!existingProfile?.last_name && lastName) {
        profileData.last_name = lastName;
      }

      // Upsert profile with organization data and name fields if needed
      const { error: profileError } = await safeProfileUpsert(profileData);

      if (profileError) {
        console.error('Profile upsert error (non-PII details):', {
          error_message: profileError.message,
          error_code: profileError.code,
          timestamp: new Date().toISOString(),
        });
        throw new Error('Failed to save profile information');
      }

      // Update auth user metadata if name fields were missing
      const currentMetadata = user.user_metadata || {};
      const needsMetadataUpdate = (
        (!currentMetadata.full_name && fullName.trim()) ||
        (!currentMetadata.first_name && firstName) ||
        (!currentMetadata.last_name && lastName)
      );

      if (needsMetadataUpdate) {
        const updatedMetadata = { ...currentMetadata };
        if (!currentMetadata.full_name && fullName.trim()) {
          updatedMetadata.full_name = fullName;
        }
        if (!currentMetadata.first_name && firstName) {
          updatedMetadata.first_name = firstName;
        }
        if (!currentMetadata.last_name && lastName) {
          updatedMetadata.last_name = lastName;
        }

        const { error: authError } = await supabase.auth.updateUser({
          data: updatedMetadata
        });

        if (authError) {
          console.error('Auth metadata update error (non-PII details):', {
            error_message: authError.message,
            timestamp: new Date().toISOString(),
          });
          // Don't throw here - profile was saved successfully, metadata update is secondary
        }
      }

      toast({
        title: "Profile completed!",
        description: "Your organization information has been saved.",
      });

      // Redirect to next URL or dashboard
      const nextUrl = searchParams.get('next') || '/dashboard';
      navigate(nextUrl);

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
            <img src={logo} alt="Tulora" className="h-8 w-auto" />
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="organizationName">Organization name *</Label>
            <Input
              id="organizationName"
              name="organizationName"
              type="text"
              placeholder="Your company name"
              value={formData.organizationName}
              onChange={handleInputChange}
              className={formErrors.organizationName ? "border-destructive" : ""}
              autoComplete="organization"
              disabled={isLoading}
            />
            {formErrors.organizationName && (
              <p className="text-xs text-destructive">{formErrors.organizationName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="organizationSize">Organization size *</Label>
            <Select 
              value={formData.organizationSize}
              onValueChange={(value) => handleSelectChange("organizationSize", value)}
              disabled={isLoading}
            >
              <SelectTrigger className={formErrors.organizationSize ? "border-destructive" : ""}>
                <SelectValue placeholder="Select organization size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1–10">1–10</SelectItem>
                <SelectItem value="11–50">11–50</SelectItem>
                <SelectItem value="51–200">51–200</SelectItem>
                <SelectItem value="201–500">201–500</SelectItem>
                <SelectItem value="501–1,000">501–1,000</SelectItem>
                <SelectItem value="1,001–5,000">1,001–5,000</SelectItem>
                <SelectItem value="5,001+">5,001+</SelectItem>
              </SelectContent>
            </Select>
            {formErrors.organizationSize && (
              <p className="text-xs text-destructive">{formErrors.organizationSize}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Industry *</Label>
            <Select 
              value={formData.industry}
              onValueChange={(value) => handleSelectChange("industry", value)}
              disabled={isLoading}
            >
              <SelectTrigger className={formErrors.industry ? "border-destructive" : ""}>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Technology">Technology</SelectItem>
                <SelectItem value="Healthcare">Healthcare</SelectItem>
                <SelectItem value="Finance">Finance</SelectItem>
                <SelectItem value="Education">Education</SelectItem>
                <SelectItem value="Retail">Retail</SelectItem>
                <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                <SelectItem value="Real Estate">Real Estate</SelectItem>
                <SelectItem value="Consulting">Consulting</SelectItem>
                <SelectItem value="Marketing">Marketing</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            {formErrors.industry && (
              <p className="text-xs text-destructive">{formErrors.industry}</p>
            )}
          </div>

          {/* Conditional "Other" industry input */}
          {formData.industry === "Other" && (
            <div className="space-y-2">
              <Label htmlFor="customIndustry">Specify industry *</Label>
              <Input
                id="customIndustry"
                name="customIndustry"
                type="text"
                placeholder="Enter your industry"
                value={formData.customIndustry}
                onChange={handleInputChange}
                className={formErrors.customIndustry ? "border-destructive" : ""}
                disabled={isLoading}
              />
              {formErrors.customIndustry && (
                <p className="text-xs text-destructive">{formErrors.customIndustry}</p>
              )}
            </div>
          )}

          {/* Submit button and Sign out link */}
          <div className="space-y-4">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : "Save & continue"}
            </Button>
            
            <div className="text-center">
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
        </form>
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