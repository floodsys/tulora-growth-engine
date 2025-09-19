import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { saveOrganization, type OrganizationData } from "@/lib/profile/saveOrganization";
import logo from "@/assets/logo.svg";

const CompleteProfile = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    organizationName: "",
    organizationSize: "",
    industry: "",
    customIndustry: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Pre-fill data from existing profile and OAuth provider
  useEffect(() => {
    const loadExistingProfile = async () => {
      if (user && !loading) {
        // First try to get data from existing profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, organization_name, organization_size, industry')
          .eq('user_id', user.id)
          .maybeSingle();

        // Fallback to OAuth provider metadata for name
        const displayName = profile?.full_name ||
                           user.user_metadata?.full_name || 
                           user.user_metadata?.name || 
                           user.user_metadata?.display_name || "";
        
        setFormData(prev => ({
          ...prev,
          fullName: displayName,
          organizationName: profile?.organization_name || "",
          organizationSize: profile?.organization_size || "",
          industry: profile?.industry || ""
        }));
      }
    };

    loadExistingProfile();
  }, [user, loading]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.fullName.trim()) {
      errors.fullName = "Full name is required";
    }
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
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !user) {
      return;
    }
    
    setIsLoading(true);

    try {
      const industry = formData.industry === "Other" ? formData.customIndustry : formData.industry;

      // Prepare organization data
      const organizationData: OrganizationData = {
        organization_name: formData.organizationName,
        organization_size: formData.organizationSize,
        industry: industry,
      };

      // Use the consistent saveOrganization function
      const result = await saveOrganization({
        userId: user.id,
        fullName: formData.fullName,
        organizationData,
        source: 'signup',
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to save profile information');
      }

      toast({
        title: "Profile completed!",
        description: "Welcome to your dashboard.",
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to complete profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 max-w-md lg:max-w-lg mx-auto lg:mx-0">
        {/* Header */}
        <div className="mb-8">
          <Link to="/">
            <img src={logo} alt="Tulora" className="h-8 w-auto mb-8" />
          </Link>
          
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Complete your profile
          </h1>
          <p className="text-muted-foreground">
            We need a few more details to set up your account.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name *</Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              placeholder="First Last"
              value={formData.fullName}
              onChange={handleInputChange}
              className={formErrors.fullName ? "border-destructive" : ""}
            />
            {formErrors.fullName && (
              <p className="text-xs text-destructive">{formErrors.fullName}</p>
            )}
          </div>

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
            />
            {formErrors.organizationName && (
              <p className="text-xs text-destructive">{formErrors.organizationName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="organizationSize">Organization size *</Label>
            <Select value={formData.organizationSize} onValueChange={(value) => handleSelectChange("organizationSize", value)}>
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
            <Select value={formData.industry} onValueChange={(value) => handleSelectChange("industry", value)}>
              <SelectTrigger className={formErrors.industry ? "border-destructive" : ""}>
                <SelectValue placeholder="Select your industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Technology">Technology</SelectItem>
                <SelectItem value="Healthcare">Healthcare</SelectItem>
                <SelectItem value="Financial Services">Financial Services</SelectItem>
                <SelectItem value="Education">Education</SelectItem>
                <SelectItem value="Retail">Retail</SelectItem>
                <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                <SelectItem value="Professional Services">Professional Services</SelectItem>
                <SelectItem value="Real Estate">Real Estate</SelectItem>
                <SelectItem value="Media & Entertainment">Media & Entertainment</SelectItem>
                <SelectItem value="Non-profit">Non-profit</SelectItem>
                <SelectItem value="Government">Government</SelectItem>
                <SelectItem value="Agriculture">Agriculture</SelectItem>
                <SelectItem value="Energy">Energy</SelectItem>
                <SelectItem value="Transportation">Transportation</SelectItem>
                <SelectItem value="Hospitality">Hospitality</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            {formErrors.industry && (
              <p className="text-xs text-destructive">{formErrors.industry}</p>
            )}
          </div>

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
              />
              {formErrors.customIndustry && (
                <p className="text-xs text-destructive">{formErrors.customIndustry}</p>
              )}
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? "Completing profile..." : "Complete profile"}
          </Button>
        </form>
      </div>

      {/* Right Panel - Image */}
      <div className="hidden lg:flex flex-1 bg-card">
        <img
          src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgdmlld0JveD0iMCAwIDgwMCA2MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjRjhGQUZDIi8+CjxjaXJjbGUgY3g9IjQwMCIgY3k9IjMwMCIgcj0iMTAwIiBmaWxsPSIjRTJFOEYwIi8+CjxjaXJjbGUgY3g9IjQwMCIgY3k9IjMwMCIgcj0iNjAiIGZpbGw9IiNBRDlCRjAiLz4KPHRleHQgeD0iNDAwIiB5PSIzMTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IndoaXRlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZvbnQtd2VpZ2h0PSJib2xkIj7inJM8L3RleHQ+Cjx0ZXh0IHg9IjQwMCIgeT0iNDIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjc4MDdDIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiPkNvbXBsZXRlIHlvdXIgcHJvZmlsZTwvdGV4dD4KPC9zdmc+"
          alt="Complete profile illustration"
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
};

export default CompleteProfile;