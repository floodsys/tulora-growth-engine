import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Shield, Activity, Users, FileText } from "lucide-react";
import { OrganizationActivityViewer } from "@/components/OrganizationActivityViewer";
import { RetentionSettings } from "@/components/RetentionSettings";
import SettingsTeams from "@/pages/SettingsTeams";
import { AdminLogsViewer } from "@/components/admin/AdminLogsViewer";
import { TeamAccessGuard } from "@/components/guards/TeamAccessGuard";

export default function SettingsOrganization() {
  const { toast } = useToast();
  const { organization, isOwner } = useUserOrganization();
  const { isAdmin } = useOrganizationRole(organization?.id);
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    size_band: '',
    website: '',
  });
  const [originalData, setOriginalData] = useState(formData);

  // Load organization data when component mounts
  useEffect(() => {
    async function loadOrganizationData() {
      if (!organization) return;

      try {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('name, website, industry, size_band')
          .eq('id', organization.id)
          .single();

        if (orgData) {
          const data = {
            name: orgData.name || '',
            website: orgData.website || '',
            industry: orgData.industry || '',
            size_band: orgData.size_band || '',
          };
          setFormData(data);
          setOriginalData(data);
        }
      } catch (error) {
        console.error('Error loading organization data:', error);
        toast({
          title: "Error loading data",
          description: "Failed to load organization settings.",
          variant: "destructive"
        });
      }
    }

    loadOrganizationData();
  }, [organization, toast]);

  // Set active tab based on URL
  useEffect(() => {
    if (location.pathname.endsWith('/team')) {
      setActiveTab('team');
    }
  }, [location.pathname]);

  // Check if user has access (Owner or Admin)
  const hasAccess = isOwner || isAdmin;

  if (!hasAccess) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              Access Restricted
            </CardTitle>
            <CardDescription>
              Only organization owners and administrators can access organization settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Contact your organization owner or administrator to make changes to organization settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if there are changes
  const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalData);

  const normalizeWebsite = (url: string): string => {
    if (!url.trim()) return "";
    let normalized = url.trim().toLowerCase();
    if (normalized && !normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = 'https://' + normalized;
    }
    return normalized;
  };

  const handleSave = async () => {
    if (!organization) {
      toast({
        title: "Error",
        description: "Organization not found.",
        variant: "destructive"
      });
      return;
    }

    if (!hasAccess) {
      toast({
        title: "Access denied",
        description: "Only owners and admins can update organization settings.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        name: formData.name.trim(),
        website: normalizeWebsite(formData.website),
        industry: formData.industry,
        size_band: formData.size_band || null
      };

      const { error } = await supabase
        .from('organizations')
        .update(updateData)
        .eq('id', organization.id);

      if (error) throw error;

      setOriginalData(formData);
      toast({
        title: "Organization updated",
        description: "Organization settings have been updated successfully.",
      });
    } catch (error: any) {
      console.error('Error updating organization:', error);
      
      // Check if this is a permissions error
      if (error.code === 'PGRST301' || error.message?.includes('access denied')) {
        toast({
          title: "Access denied",
          description: "Only owners and admins can update organization profile.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Update failed",
          description: error.message || "Failed to update organization settings.",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="h-8 w-8" />
          Organization
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your organization information and preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
          {isOwner && (
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Admin Logs
            </TabsTrigger>
          )}
          <TabsTrigger value="privacy" className="flex items-center gap-2" disabled={!isOwner}>
            <Shield className="h-4 w-4" />
            Privacy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          {/* Organization Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization Information
              </CardTitle>
              <CardDescription>
                Update your organization's basic information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                    <Input
                      id="orgName"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter organization name"
                      disabled={!hasAccess}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://example.com"
                      disabled={!hasAccess}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select value={formData.industry} onValueChange={(value) => setFormData({ ...formData, industry: value })} disabled={!hasAccess}>
                    <SelectTrigger>
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="size">Organization Size</Label>
                  <Select value={formData.size_band} onValueChange={(value) => setFormData({ ...formData, size_band: value })} disabled={!hasAccess}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1-10 employees</SelectItem>
                      <SelectItem value="11-50">11-50 employees</SelectItem>
                      <SelectItem value="51-200">51-200 employees</SelectItem>
                      <SelectItem value="201-1000">201-1000 employees</SelectItem>
                      <SelectItem value="1000+">1000+ employees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!hasAccess && (
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-sm text-muted-foreground">
                    <strong>Admins only.</strong> You have read-only access to organization settings.
                  </p>
                </div>
              )}

              <Button onClick={handleSave} disabled={!hasChanges || !hasAccess || loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          {/* Organization Details */}
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>
                View organization metadata and information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Organization ID</Label>
                  <div className="bg-muted p-2 rounded text-sm font-mono">
                    {organization?.id}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Created</Label>
                  <div className="bg-muted p-2 rounded text-sm">
                    {organization?.created_at ? new Date(organization.created_at).toLocaleDateString() : 'Unknown'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <TeamAccessGuard>
            <SettingsTeams />
          </TeamAccessGuard>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <OrganizationActivityViewer />
        </TabsContent>

        {isOwner && (
          <TabsContent value="logs" className="space-y-6">
            <AdminLogsViewer />
          </TabsContent>
        )}

        <TabsContent value="privacy" className="space-y-6">
          {isOwner && organization && (
            <RetentionSettings 
              organizationId={organization.id}
              isOwner={isOwner}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}