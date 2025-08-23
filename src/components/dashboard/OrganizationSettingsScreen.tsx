import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Trash2, Plus, Minus, Shield } from "lucide-react"
import { IntegrationsSettings } from "./settings/IntegrationsSettings"
import { BillingSettings } from "./settings/BillingSettings"
import { OrganizationDangerZone } from "./settings/OrganizationDangerZone"
import { useOrganizationRole } from "@/hooks/useOrganizationRole"
import { TeamManagement } from "./TeamManagement"

// Mock data
const memberSeats = [
  { id: 1, name: "John Doe", email: "john@company.com", role: "Owner", seatActive: true },
  { id: 2, name: "Jane Smith", email: "jane@company.com", role: "Admin", seatActive: true },
  { id: 3, name: "Bob Wilson", email: "bob@company.com", role: "Member", seatActive: true },
  { id: 4, name: "Alice Brown", email: "alice@company.com", role: "Member", seatActive: false },
]

const seatData = { total: 10, used: 3, available: 7 }

export function OrganizationSettingsScreen() {
  // TODO: Get organization ID from context or props - for now use mock
  const mockOrgId = "mock-org-id"
  const { isAdmin, role, loading } = useOrganizationRole(mockOrgId)
  const [activeTab, setActiveTab] = useState("organization")
  
  // Show permission error for non-owners
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              Access Restricted
            </CardTitle>
            <CardDescription>
              Only organization admins can access organization settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Your current role: <Badge variant="secondary">{role}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Contact your organization admin to access these settings or modify your permissions.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }
  const [orgData, setOrgData] = useState({
    name: "My Organization",
    website: "https://myorg.com",
    industry: "Technology",
  })
  const [newSeatCount, setNewSeatCount] = useState(seatData.total)

  const handleUpdateOrg = () => {
    // TODO: Implement organization update logic
    console.log("Organization update:", orgData)
  }

  const handleUpdateSeats = () => {
    // TODO: Implement seat update logic
    console.log("Update seats to:", newSeatCount)
  }

  const handleToggleSeat = (memberId: number, currentStatus: boolean) => {
    if (!currentStatus && seatData.available === 0) {
      alert("No available seats. Please purchase more seats first.")
      return
    }
    // TODO: Implement seat toggle logic
    console.log("Toggle seat for member:", memberId, "to:", !currentStatus)
  }

  const renderContent = () => {
    switch (activeTab) {
      case "organization":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Organization Information</CardTitle>
                <CardDescription>Manage your organization's basic information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    value={orgData.name}
                    onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={orgData.website}
                    onChange={(e) => setOrgData({ ...orgData, website: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select
                    value={orgData.industry}
                    onValueChange={(value) => setOrgData({ ...orgData, industry: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Technology">Technology</SelectItem>
                      <SelectItem value="Healthcare">Healthcare</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                      <SelectItem value="Education">Education</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleUpdateOrg}>
                  Update Organization
                </Button>
              </CardContent>
            </Card>
          </div>
        )
      case "members":
        return <TeamManagement />
      case "seats":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Seats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{seatData.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Used Seats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{seatData.used}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Available Seats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{seatData.available}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Manage Seats</CardTitle>
                <CardDescription>Update the total number of seats for your organization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setNewSeatCount(Math.max(1, newSeatCount - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={newSeatCount}
                    onChange={(e) => setNewSeatCount(parseInt(e.target.value) || 0)}
                    className="w-20 text-center"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setNewSeatCount(newSeatCount + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button onClick={handleUpdateSeats} disabled={newSeatCount === seatData.total}>
                    Update Seats
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Member Seat Assignments</CardTitle>
                <CardDescription>Activate or deactivate seats for individual members</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {memberSeats.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-sm text-muted-foreground">{member.email}</div>
                        </div>
                        <Badge variant={member.role === "Owner" ? "default" : "secondary"}>
                          {member.role}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`text-sm ${member.seatActive ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {member.seatActive ? 'Active' : 'Inactive'}
                        </span>
                        {member.role !== "Owner" && (
                          <Switch
                            checked={member.seatActive}
                            onCheckedChange={() => handleToggleSeat(member.id, member.seatActive)}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )
      case "integrations":
        return <IntegrationsSettings />
      case "billing":
        return <BillingSettings />
      case "danger":
        return <OrganizationDangerZone />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Organization Settings</h1>
        <p className="text-muted-foreground mb-6">Manage your organization information and team settings</p>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 h-auto p-1 bg-muted/50">
            <TabsTrigger value="organization" className="text-xs">ORGANIZATION</TabsTrigger>
            <TabsTrigger value="members" className="text-xs">TEAM</TabsTrigger>
            <TabsTrigger value="seats" className="text-xs">SEATS</TabsTrigger>
            <TabsTrigger value="integrations" className="text-xs">INTEGRATIONS</TabsTrigger>
            <TabsTrigger value="billing" className="text-xs">BILLING</TabsTrigger>
            <TabsTrigger value="danger" className="text-xs">DANGER ZONE</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1">
        {renderContent()}
      </div>
    </div>
  )
}