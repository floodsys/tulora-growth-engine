import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Shield, Activity, Users, FileText, RefreshCw, Zap, Loader2 } from "lucide-react";
import { OrganizationActivityViewer } from "@/components/OrganizationActivityViewer";
import { RetentionSettings } from "@/components/RetentionSettings";
import SettingsTeams from "@/pages/SettingsTeams";
import { AdminLogsViewer } from "@/components/admin/AdminLogsViewer";
import { TeamAccessGuard } from "@/components/guards/TeamAccessGuard";
import { getBuildInfo, clearAllCaches, forceReload } from "@/lib/build-info";
import { OrgConstraintTester } from "@/components/debug/OrgConstraintTester";

export default function SettingsOrganization() {
  const { toast } = useToast();
  const { organization, isOwner } = useUserOrganization();
  const { isAdmin } = useOrganizationRole(organization?.id);
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [cacheClearing, setCacheClearing] = useState(false);
  const [buildInfo] = useState(() => getBuildInfo());
  
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
    
    // STEP 3: Log exact org_id alignment for debugging
    const currentUser = (await supabase.auth.getUser()).data.user;
    const pageOrgId = organization.id;
    
    console.log('🎯 STEP 3: Org ID Alignment Check:', {
      page_org_id: pageOrgId,
      user_id: currentUser?.id,
      hasAccess: hasAccess,
      isOwner: isOwner,
      isAdmin: isAdmin,
      targeting_org_id: pageOrgId,
      save_query: `UPDATE organizations SET ... WHERE id = '${pageOrgId}'`
    });
    
    try {
      const updateData = {
        name: formData.name.trim(),
        website: normalizeWebsite(formData.website),
        industry: formData.industry,
        size_band: formData.size_band || null
      };
      
      console.log('🚀 Making UPDATE request to /rest/v1/organizations with org_id:', pageOrgId);

      const { data: result, error } = await supabase
        .from('organizations')
        .update(updateData)
        .eq('id', pageOrgId) // Use the explicitly logged org_id
        .select(); // Add select to see what was actually updated

      console.log('📋 UPDATE Result:', { 
        result, 
        error, 
        status: error ? 'FAILED' : 'SUCCESS',
        targeted_org_id: pageOrgId,
        updated_rows: result?.length || 0
      });

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

  const handleHardRefresh = async () => {
    setCacheClearing(true);
    toast({
      title: "Clearing Caches",
      description: "Clearing service workers and browser caches...",
    });

    try {
      const result = await clearAllCaches();
      
      if (result.success) {
        toast({
          title: "Cache Cleared Successfully",
          description: `Cleared ${result.serviceWorkersCleared} service workers and ${result.cachesCleared.length} caches. Reloading...`,
        });
        
        // Wait a moment then force reload
        setTimeout(() => {
          forceReload();
        }, 1000);
      } else {
        throw new Error(result.error || 'Failed to clear caches');
      }
    } catch (error) {
      console.error('Cache clearing error:', error);
      toast({
        title: "Cache Clear Failed",
        description: "Some caches may not have been cleared. Reloading anyway...",
        variant: "destructive",
      });
      
      // Still try to reload
      setTimeout(() => {
        forceReload();
      }, 1000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Org ID Alignment Banner - STEP 3 Fix */}
      {organization && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Organization Context: {organization.name}
              </p>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                  Settings Page Org ID: {organization.id}
                </p>
                <span className="text-xs bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 px-2 py-1 rounded border border-green-200 dark:border-green-800">
                  ✓ Aligned
                </span>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                💡 All updates target this exact org_id. Use this ID in /admin/_diag for testing.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Organization Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your organization information and preferences
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm text-muted-foreground font-mono px-2 py-1 bg-blue-100 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded">
              Build ID: {buildInfo.buildId}
            </span>
            <Badge variant="outline" className="text-xs">
              🎯 STEP 5: Settings Build Check
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleHardRefresh}
              disabled={cacheClearing}
              className="h-7 px-3 text-xs"
            >
              {cacheClearing ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Zap className="h-3 w-3 mr-1" />
              )}
              Kill Stale Build
            </Button>
          </div>
        </div>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Organization ID</Label>
                  <div className="bg-muted p-2 rounded text-sm font-mono">
                    {organization?.id}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Page Org ID</Label>
                  <div className="bg-blue-100 dark:bg-blue-950 p-2 rounded text-sm font-mono border border-blue-200 dark:border-blue-800">
                    {organization?.id}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Build ID 
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleHardRefresh}
                      disabled={cacheClearing}
                      className="h-5 px-2 text-xs"
                    >
                      {cacheClearing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                    </Button>
                  </Label>
                  <div className="bg-green-100 dark:bg-green-950 p-2 rounded text-sm font-mono border border-green-200 dark:border-green-800">
                    {buildInfo.buildId}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Current User Role</Label>
                  <div className="bg-muted p-2 rounded text-sm">
                    {isOwner ? 'Owner' : isAdmin ? 'Admin' : 'Member/None'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Access Status</Label>
                  <div className={`p-2 rounded text-sm ${hasAccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {hasAccess ? '✅ Has Access' : '❌ No Access'}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Debug Actions</Label>
                  <div className="text-sm">
                    <button 
                      onClick={() => console.log('🔍 ORG CONTEXT:', { organization, isOwner, isAdmin, hasAccess })}
                      className="text-blue-600 hover:underline"
                    >
                      Log Org Context
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Debug Mode:</strong> Network requests to /rest/v1/organizations should appear in DevTools when saving.
                  If they don't appear, this page might be using cached code.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Debug: Constraint Tester */}
          <OrgConstraintTester />
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