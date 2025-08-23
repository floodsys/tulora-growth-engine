import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function OrganizationSettings() {
  const { toast } = useToast()
  const [orgName, setOrgName] = useState("Acme Corporation")
  const [orgSlug, setOrgSlug] = useState("acme-corp")

  const handleUpdateOrganization = () => {
    // TODO: Implement organization update
    toast({
      title: "Organization updated",
      description: "Organization settings have been updated successfully.",
    })
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
          <CardDescription>Update your organization name and settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Enter organization name"
            />
          </div>

          <div>
            <Label htmlFor="orgSlug">Organization Slug</Label>
            <Input
              id="orgSlug"
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value)}
              placeholder="organization-slug"
            />
            <p className="text-sm text-muted-foreground mt-1">
              This will be used in URLs and API calls
            </p>
          </div>

          <Button onClick={handleUpdateOrganization}>
            Update Organization
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}