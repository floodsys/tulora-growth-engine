import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Globe, Users, MapPin, Calendar, Upload } from "lucide-react";

interface OrganizationInfoProps {
  organizationId?: string;
}

interface OrganizationData {
  name: string;
  website: string;
  industry: string;
  size_band: string;
  description: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  logo_url: string;
  status: string;
  created_at: string;
}

export function OrganizationInfo({ organizationId }: OrganizationInfoProps) {
  const [orgData, setOrgData] = useState<OrganizationData>({
    name: "",
    website: "",
    industry: "",
    size_band: "",
    description: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "US",
    postal_code: "",
    logo_url: "",
    status: "active",
    created_at: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (organizationId) {
      loadOrganizationData();
    }
  }, [organizationId]);

  const loadOrganizationData = async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

      if (error) throw error;

      setOrgData({
        name: data.name || "",
        website: data.website || "",
        industry: data.industry || "",
        size_band: data.size_band || "",
        description: "", // Not in schema, would need to add
        phone: "", // Not in schema, would need to add
        address: "", // Not in schema, would need to add
        city: "", // Not in schema, would need to add
        state: "", // Not in schema, would need to add
        country: "US",
        postal_code: "", // Not in schema, would need to add
        logo_url: "", // Not in schema, would need to add
        status: data.status || "active",
        created_at: data.created_at || ""
      });
    } catch (error) {
      console.error('Error loading organization data:', error);
      toast({
        title: "Error",
        description: "Failed to load organization information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveOrganizationData = async () => {
    if (!organizationId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: orgData.name,
          website: orgData.website,
          industry: orgData.industry,
          size_band: orgData.size_band
        })
        .eq('id', organizationId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Organization information updated successfully",
      });
    } catch (error) {
      console.error('Error saving organization data:', error);
      toast({
        title: "Error",
        description: "Failed to save organization information",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateOrgData = (updates: Partial<OrganizationData>) => {
    setOrgData(prev => ({ ...prev, ...updates }));
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      case 'trial': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization Information</CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Information
            </CardTitle>
            <CardDescription>
              Manage your organization's basic information and profile
            </CardDescription>
          </div>
          <Badge className={getStatusBadgeColor(orgData.status)}>
            {orgData.status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo and Basic Info */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-20 w-20">
              <AvatarImage src={orgData.logo_url} />
              <AvatarFallback className="text-lg">
                {orgData.name ? orgData.name.charAt(0).toUpperCase() : <Building2 className="h-8 w-8" />}
              </AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload Logo
            </Button>
          </div>
          
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name *</Label>
                <Input
                  id="orgName"
                  value={orgData.name}
                  onChange={(e) => updateOrgData({ name: e.target.value })}
                  placeholder="Enter organization name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="website"
                    type="url"
                    value={orgData.website}
                    onChange={(e) => updateOrgData({ website: e.target.value })}
                    placeholder="https://example.com"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {orgData.created_at && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Created on {new Date(orgData.created_at).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={orgData.description}
            onChange={(e) => updateOrgData({ description: e.target.value })}
            placeholder="Brief description of your organization"
            rows={3}
          />
        </div>

        {/* Industry and Size */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Select
              value={orgData.industry}
              onValueChange={(industry) => updateOrgData({ industry })}
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
                <SelectItem value="consulting">Consulting</SelectItem>
                <SelectItem value="marketing">Marketing & Advertising</SelectItem>
                <SelectItem value="legal">Legal Services</SelectItem>
                <SelectItem value="nonprofit">Non-profit</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="size">Organization Size</Label>
            <Select
              value={orgData.size_band}
              onValueChange={(size_band) => updateOrgData({ size_band })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Just me (1 person)</SelectItem>
                <SelectItem value="2-10">Small team (2-10 people)</SelectItem>
                <SelectItem value="11-50">Growing company (11-50 people)</SelectItem>
                <SelectItem value="51-200">Medium company (51-200 people)</SelectItem>
                <SelectItem value="201-500">Large company (201-500 people)</SelectItem>
                <SelectItem value="501+">Enterprise (501+ people)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Contact Information
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={orgData.phone}
                onChange={(e) => updateOrgData({ phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select
                value={orgData.country}
                onValueChange={(country) => updateOrgData({ country })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                  <SelectItem value="GB">United Kingdom</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                  <SelectItem value="DE">Germany</SelectItem>
                  <SelectItem value="FR">France</SelectItem>
                  <SelectItem value="JP">Japan</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={orgData.address}
              onChange={(e) => updateOrgData({ address: e.target.value })}
              placeholder="Street address"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={orgData.city}
                onChange={(e) => updateOrgData({ city: e.target.value })}
                placeholder="City"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State/Province</Label>
              <Input
                id="state"
                value={orgData.state}
                onChange={(e) => updateOrgData({ state: e.target.value })}
                placeholder="State or Province"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postal">Postal Code</Label>
              <Input
                id="postal"
                value={orgData.postal_code}
                onChange={(e) => updateOrgData({ postal_code: e.target.value })}
                placeholder="ZIP/Postal Code"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={saveOrganizationData} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}