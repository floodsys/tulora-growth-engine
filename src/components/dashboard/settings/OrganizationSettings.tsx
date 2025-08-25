import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { supabase } from "@/integrations/supabase/client"
import CallHandlingSettings from "./CallHandlingSettings"

const INDUSTRY_OPTIONS = [
  "Technology",
  "Healthcare", 
  "Finance",
  "Education",
  "Retail",
  "Manufacturing",
  "Real Estate",
  "Consulting",
  "Marketing",
  "Other"
]

const SIZE_OPTIONS = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-1000", label: "201-1000 employees" },
  { value: "1000+", label: "1000+ employees" }
]

export function OrganizationSettings() {
  const { toast } = useToast()
  const { organization, isOwner, loading } = useUserOrganization()
  const [formData, setFormData] = useState({
    name: "",
    website: "",
    industry: "",
    size_band: ""
  })
  const [originalData, setOriginalData] = useState(formData)
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function loadOrganizationData() {
      if (!organization) return

      try {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('name, website, industry, size_band')
          .eq('id', organization.id)
          .single()

        if (orgData) {
          const data = {
            name: orgData.name || "",
            website: orgData.website || "",
            industry: orgData.industry || "",
            size_band: orgData.size_band || ""
          }
          setFormData(data)
          setOriginalData(data)
        }

        // Check if user is admin or owner
        setIsAdmin(isOwner || false)
        
        // Double-check with RPC if not owner
        if (!isOwner) {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: adminCheck } = await supabase.rpc('is_org_admin', { org_id: organization.id })
            setIsAdmin(!!adminCheck)
          }
        }
      } catch (error) {
        console.error('Error loading organization data:', error)
        toast({
          title: "Error loading data",
          description: "Failed to load organization settings.",
          variant: "destructive"
        })
      }
    }

    loadOrganizationData()
  }, [organization, isOwner, toast])

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalData)

  const normalizeWebsite = (url: string): string => {
    if (!url.trim()) return ""
    let normalized = url.trim().toLowerCase()
    if (normalized && !normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = 'https://' + normalized
    }
    return normalized
  }

  const handleUpdateOrganization = async () => {
    if (!organization) {
      toast({
        title: "Error",
        description: "Organization not found.",
        variant: "destructive"
      })
      return
    }

    if (!isOwner && !isAdmin) {
      toast({
        title: "Access denied",
        description: "You need admin access to update organization settings.",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      const updateData = {
        name: formData.name.trim(),
        website: normalizeWebsite(formData.website),
        industry: formData.industry,
        size_band: formData.size_band || null
      }

      const { error } = await supabase
        .from('organizations')
        .update(updateData)
        .eq('id', organization.id)

      if (error) throw error

      setOriginalData(formData)
      toast({
        title: "Organization updated",
        description: "Organization settings have been updated successfully.",
      })
    } catch (error: any) {
      console.error('Error updating organization:', error)
      toast({
        title: "Update failed",
        description: error.message || "Failed to update organization settings.",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Organization Settings</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <p className="text-muted-foreground">Manage your organization information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Organization Information</span>
          </CardTitle>
          <CardDescription>Update your organization profile and settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter organization name"
              disabled={!isOwner && !isAdmin}
            />
          </div>

          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={formData.website}
              onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
              placeholder="https://example.com"
              disabled={!isOwner && !isAdmin}
            />
          </div>

          <div>
            <Label htmlFor="industry">Industry</Label>
            <Select 
              value={formData.industry} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, industry: value }))}
              disabled={!isOwner && !isAdmin}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((industry) => (
                  <SelectItem key={industry} value={industry}>
                    {industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="size">Organization Size</Label>
            <Select 
              value={formData.size_band} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, size_band: value }))}
              disabled={!isOwner && !isAdmin}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select organization size" />
              </SelectTrigger>
              <SelectContent>
                {SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isOwner && !isAdmin && (
            <p className="text-sm text-muted-foreground">
              You need admin access to update organization settings.
            </p>
          )}

          <Button 
            onClick={handleUpdateOrganization}
            disabled={!hasChanges || (!isOwner && !isAdmin) || saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      <CallHandlingSettings />
    </div>
  )
}