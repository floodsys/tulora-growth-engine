import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Building2, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/integrations/supabase/client"
import { useUserOrganization } from "@/hooks/useUserOrganization"
import { Link } from "react-router-dom"

export function OrganizationInfo() {
  const { user } = useAuth()
  const { organization, loading: orgLoading, isOwner } = useUserOrganization()
  const [profileData, setProfileData] = useState<any>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [orgDetails, setOrgDetails] = useState<any>(null)

  // Load profile and organization data
  useEffect(() => {
    const loadData = async () => {
      if (!user) return
      
      try {
        // Load profile data
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_name, organization_size, industry')
          .eq('user_id', user.id)
          .single()
        
        setProfileData(profile)

        // Load full organization details if we have an organization
        if (organization?.id) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('name, website, industry, size_band')
            .eq('id', organization.id)
            .single()
          
          setOrgDetails(orgData)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoadingProfile(false)
      }
    }
    
    loadData()
  }, [user, organization?.id])

  // Set up real-time subscription for organization changes
  useEffect(() => {
    if (!organization?.id) return

    const channel = supabase
      .channel('organization-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'organizations',
          filter: `id=eq.${organization.id}`
        },
        (payload) => {
          // Update local state when organization changes
          setOrgDetails(prev => ({
            ...prev,
            name: payload.new.name,
            size_band: payload.new.size_band,
            industry: payload.new.industry,
            website: payload.new.website
          }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [organization?.id])

  const isLoading = isLoadingProfile || orgLoading

  // Use organization data if available, fallback to profile data
  const displayData = {
    organization_name: orgDetails?.name || organization?.name || profileData?.organization_name,
    organization_size: orgDetails?.size_band || profileData?.organization_size,
    industry: orgDetails?.industry || profileData?.industry,
    website: orgDetails?.website
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Organization Information
        </CardTitle>
        <CardDescription>
          Your organization details
          {isOwner && (
            <span className="text-muted-foreground">
              {" "}• You can modify these in organization settings
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded animate-pulse"></div>
            <div className="h-4 bg-muted rounded animate-pulse w-2/3"></div>
            <div className="h-4 bg-muted rounded animate-pulse w-1/2"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Organization Name</Label>
                <div className="font-medium">{displayData.organization_name || "Not provided"}</div>
              </div>
              {displayData.website && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Website</Label>
                  <div className="font-medium">
                    <a 
                      href={displayData.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {displayData.website}
                    </a>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Organization Size</Label>
                <div className="font-medium">{displayData.organization_size || "Not provided"}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Industry</Label>
                <div className="font-medium">{displayData.industry || "Not provided"}</div>
              </div>
            </div>
            
            {isOwner && (
              <div className="pt-4 border-t">
                <Button asChild variant="outline" size="sm">
                  <Link to="/settings/organization" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Manage Organization Settings
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}