import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Settings, Shield, Trash2 } from "lucide-react";
import { AlertsSettings } from "./AlertsSettings";
import { BillingSettings } from "./BillingSettings";
import { CallHandlingSettings } from "./CallHandlingSettings";
import { ExportAndIntegrationsSettings } from "./ExportAndIntegrationsSettings";
import { IntegrationsSettings } from "./IntegrationsSettings";

interface OrganizationSettingsProps {
  organizationId?: string;
}

interface OrganizationInfo {
  name: string;
  website: string;
  industry: string;
  size_band: string;
  status: string;
}

export function OrganizationSettings({ organizationId }: OrganizationSettingsProps) {
  const [orgInfo, setOrgInfo] = useState<OrganizationInfo>({
    name: "",
    website: "",
    industry: "",
    size_band: "",
    status: "active"
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadOrganizationInfo = async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('name, website, industry, size_band, status')
        .eq('id', organizationId)
        .single();

      if (error) throw error;

      setOrgInfo({
        name: data.name || "",
        website: data.website || "",
        industry: data.industry || "",
        size_band: data.size_band || "",
        status: data.status || "active"
      });
    } catch (error) {
      console.error('Error loading organization info:', error);
      toast({
        title: "Error",
        description: "Failed to load organization information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveOrganizationInfo = async () => {
    if (!organizationId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: orgInfo.name,
          website: orgInfo.website,
          industry: orgInfo.industry,
          size_band: orgInfo.size_band
        })
        .eq('id', organizationId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Organization information updated successfully",
      });
    } catch (error) {
      console.error('Error saving organization info:', error);
      toast({
        title: "Error",
        description: "Failed to save organization information",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateOrgInfo = (updates: Partial<OrganizationInfo>) => {
    setOrgInfo(prev => ({ ...prev, ...updates }));
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      case 'trial': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Organization Settings</h1>
          <p className="text-muted-foreground">
            Manage your organization's information and configuration
          </p>
        </div>
        <Badge className={getStatusBadgeColor(orgInfo.status)}>
          {orgInfo.status.toUpperCase()}
        </Badge>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="calls">Call Handling</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization Information
              </CardTitle>
              <CardDescription>
                Basic information about your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    value={orgInfo.name}
                    onChange={(e) => updateOrgInfo({ name: e.target.value })}
                    placeholder="Enter organization name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={orgInfo.website}
                    onChange={(e) => updateOrgInfo({ website: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select
                    value={orgInfo.industry}
                    onValueChange={(industry) => updateOrgInfo({ industry })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="real_estate">Real Estate</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="size">Organization Size</Label>
                  <Select
                    value={orgInfo.size_band}
                    onValueChange={(size_band) => updateOrgInfo({ size_band })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1-10 employees</SelectItem>
                      <SelectItem value="11-50">11-50 employees</SelectItem>
                      <SelectItem value="51-200">51-200 employees</SelectItem>
                      <SelectItem value="201-500">201-500 employees</SelectItem>
                      <SelectItem value="501+">501+ employees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={saveOrganizationInfo} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <BillingSettings organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="alerts">
          <AlertsSettings organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="calls">
          <CallHandlingSettings organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <IntegrationsSettings organizationId={organizationId} />
          <ExportAndIntegrationsSettings organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="danger">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                <h4 className="font-medium text-red-800 mb-2">Delete Organization</h4>
                <p className="text-sm text-red-600 mb-4">
                  Once you delete an organization, there is no going back. This will permanently delete 
                  all data, including calls, agents, and settings.
                </p>
                <Button variant="destructive" disabled>
                  Delete Organization
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}