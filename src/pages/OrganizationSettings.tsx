import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { RetentionSettings } from "@/components/RetentionSettings";
import { Link } from "react-router-dom";
import { Building2, Shield, Clock, ExternalLink, Save } from "lucide-react";

interface OrganizationFormData {
  name: string;
  website: string;
  industry: string;
  size: string;
  customIndustry: string;
}

export default function OrganizationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<OrganizationFormData>({
    name: "",
    website: "",
    industry: "",
    size: "",
    customIndustry: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { organization, organizationId, isOwner } = useUserOrganization();
  const { isAdmin } = useOrganizationRole(organizationId || undefined);

  const canEdit = isOwner || isAdmin;

  useEffect(() => {
    if (organizationId && organization) {
      loadOrganizationData();
    }
  }, [organizationId, organization]);

  const loadOrganizationData = async () => {
    if (!organizationId) return;

    try {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();

      if (orgData) {
        setFormData({
          name: orgData.name || '',
          website: '',
          industry: '',
          size: '',
          customIndustry: '',
        });
      }
    } catch (error) {
      console.error('Error loading organization:', error);
      toast({
        title: "Error",
        description: "Failed to load organization settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = "Organization name is required";
    }
    if (!formData.industry) {
      errors.industry = "Industry is required";
    }
    if (formData.industry === "Other" && !formData.customIndustry.trim()) {
      errors.customIndustry = "Please specify your industry";
    }
    if (!formData.size) {
      errors.size = "Organization size is required";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !organizationId || !canEdit) {
      return;
    }
    
    setSaving(true);

    try {
      const industry = formData.industry === "Other" ? formData.customIndustry : formData.industry;

      const { error } = await supabase
        .from('organizations')
        .update({
          name: formData.name,
        })
        .eq('id', organizationId);

      if (error) throw error;

      toast({
        title: "Organization updated",
        description: "Your organization settings have been saved successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update organization. Please try again.",
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
            <Building2 className="h-6 w-6" />
            <h1 className="text-2xl font-semibold">Organization Settings</h1>
          </div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Organization Settings</h1>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="compliance">Data & Compliance</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Organization Information</CardTitle>
                <CardDescription>
                  Basic information about your organization. Changes require admin permissions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Organization name *</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Your organization name"
                      value={formData.name}
                      onChange={handleInputChange}
                      disabled={!canEdit}
                      className={formErrors.name ? "border-destructive" : ""}
                    />
                    {formErrors.name && (
                      <p className="text-xs text-destructive">{formErrors.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      name="website"
                      type="url"
                      placeholder="https://yourcompany.com"
                      value={formData.website}
                      onChange={handleInputChange}
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="size">Organization size *</Label>
                    <Select 
                      value={formData.size}
                      onValueChange={(value) => handleSelectChange("size", value)}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className={formErrors.size ? "border-destructive" : ""}>
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
                    {formErrors.size && (
                      <p className="text-xs text-destructive">{formErrors.size}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry *</Label>
                    <Select 
                      value={formData.industry || (formData.customIndustry ? "Other" : "")}
                      onValueChange={(value) => handleSelectChange("industry", value)}
                      disabled={!canEdit}
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
                        disabled={!canEdit}
                        className={formErrors.customIndustry ? "border-destructive" : ""}
                      />
                      {formErrors.customIndustry && (
                        <p className="text-xs text-destructive">{formErrors.customIndustry}</p>
                      )}
                    </div>
                  )}

                  {canEdit && (
                    <div className="pt-4">
                      <Button type="submit" disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6">
            {organizationId && (
              <RetentionSettings organizationId={organizationId} isOwner={isOwner} />
            )}
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Security Settings
                  </CardTitle>
                  <CardDescription>
                    Advanced security and access control settings for your organization.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Access Control</h4>
                      <p className="text-sm text-muted-foreground">
                        Manage user permissions and access policies
                      </p>
                    </div>
                    <Button variant="outline" asChild>
                      <Link to="/access-control">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open Settings
                      </Link>
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Abuse Prevention</h4>
                      <p className="text-sm text-muted-foreground">
                        Configure fraud detection and security monitoring
                      </p>
                    </div>
                    <Button variant="outline" asChild>
                      <Link to="/abuse-prevention">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open Settings
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}