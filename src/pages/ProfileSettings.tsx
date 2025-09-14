import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { safeProfileUpsert, splitFullName } from "@/lib/profileUtils";
import { User, Save } from "lucide-react";

interface ProfileFormData {
  fullName: string;
  organizationName: string;
  organizationSize: string;
  industry: string;
  customIndustry: string;
}

export default function ProfileSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>({
    fullName: "",
    organizationName: "",
    organizationSize: "",
    industry: "",
    customIndustry: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  }, [user]);

  const loadProfileData = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, organization_name, organization_size, industry')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setFormData({
          fullName: profile.full_name || '',
          organizationName: profile.organization_name || '',
          organizationSize: profile.organization_size || '',
          industry: profile.industry || '',
          customIndustry: profile.industry && !['Technology', 'Healthcare', 'Financial Services', 'Education', 'Retail', 'Manufacturing', 'Professional Services', 'Real Estate', 'Media & Entertainment', 'Non-profit', 'Government', 'Agriculture', 'Energy', 'Transportation', 'Hospitality'].includes(profile.industry) ? profile.industry : '',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
    
    setSaving(true);

    try {
      const { firstName, lastName } = splitFullName(formData.fullName);
      const industry = formData.industry === "Other" ? formData.customIndustry : formData.industry;

      // Use safe upsert that won't overwrite existing data with empty values
      const { error: profileError } = await safeProfileUpsert({
        user_id: user.id,
        full_name: formData.fullName,
        first_name: firstName,
        last_name: lastName,
        email: user.email || '',
        organization_name: formData.organizationName,
        organization_size: formData.organizationSize,
        industry: industry,
      });

      if (profileError) throw profileError;

      // Update auth user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: formData.fullName,
          first_name: firstName,
          last_name: lastName,
          organization_name: formData.organizationName,
          organization_size: formData.organizationSize,
          industry: industry,
        }
      });

      if (updateError) {
        console.error('Auth metadata update error:', updateError);
        // Don't fail the flow for metadata update errors
      }

      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <User className="h-6 w-6" />
            <h1 className="text-2xl font-semibold">Profile Settings</h1>
          </div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <User className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Profile Settings</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Update your personal and professional information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <Select 
                  value={formData.organizationSize}
                  onValueChange={(value) => handleSelectChange("organizationSize", value)}
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
                  value={formData.industry || (formData.customIndustry ? "Other" : "")}
                  onValueChange={(value) => handleSelectChange("industry", value)}
                >
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
                  <Label htmlFor="customIndustry">Please specify your industry *</Label>
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

              <div className="pt-6">
                <Button type="submit" disabled={saving} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}