import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { 
  User, 
  Bell, 
  Shield, 
  Building, 
  Users, 
  CreditCard, 
  Settings, 
  Trash2,
  Crown,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useOrganizationRole } from "@/hooks/useOrganizationRole"

interface UnifiedSettingsProps {
  organizationId?: string;
}

export function UnifiedSettings({ organizationId }: UnifiedSettingsProps) {
  const { user } = useAuth();
  const { isAdmin, role, loading } = useOrganizationRole(organizationId);
  const [activeTab, setActiveTab] = useState("personal");

  // Environment guard for dev-only mock data
  const isDev = (import.meta?.env?.DEV ?? process?.env?.NODE_ENV === 'development');

  // Mock data - in production, this would come from the database
  const [personalData, setPersonalData] = useState({
    name: user?.user_metadata?.full_name || "John Doe",
    email: user?.email || "john@example.com",
    avatar: user?.user_metadata?.avatar_url || "",
    notifications: {
      email: true,
      sms: false,
      browser: true
    },
    security: {
      twoFactor: false,
      sessions: 3
    }
  });

  const [orgData, setOrgData] = useState({
    name: "Acme Corporation",
    plan: "Starter",
    seats: { used: 8, total: 10 },
    billing: {
      status: "active",
      nextBilling: "2024-02-15",
      amount: 497
    }
  });

  const mockMembers = [
    { id: 1, name: "John Doe", email: "john@acme.com", role: "admin", avatar: "" },
    { id: 2, name: "Jane Smith", email: "jane@acme.com", role: "editor", avatar: "" },
    { id: 3, name: "Bob Wilson", email: "bob@acme.com", role: "viewer", avatar: "" }
  ];

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your personal and organization settings</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 h-auto p-1 bg-muted/50">
          <TabsTrigger value="personal" className="text-xs flex items-center gap-2">
            <User className="h-3 w-3" />
            PERSONAL
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs flex items-center gap-2">
            <Bell className="h-3 w-3" />
            NOTIFICATIONS
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs flex items-center gap-2">
            <Shield className="h-3 w-3" />
            SECURITY
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="organization" className="text-xs flex items-center gap-2">
                <Building className="h-3 w-3" />
                ORGANIZATION
              </TabsTrigger>
              <TabsTrigger value="team" className="text-xs flex items-center gap-2">
                <Users className="h-3 w-3" />
                TEAM
              </TabsTrigger>
              <TabsTrigger value="billing" className="text-xs flex items-center gap-2">
                <CreditCard className="h-3 w-3" />
                BILLING
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Personal Settings */}
        <TabsContent value="personal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={personalData.avatar} />
                  <AvatarFallback>{personalData.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <Button variant="outline" size="sm">Change Avatar</Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={personalData.name}
                    onChange={(e) => setPersonalData({...personalData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    value={personalData.email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
              </div>
              
              <Button>Save Changes</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Danger Zone
              </CardTitle>
              <CardDescription>Permanently delete your account and all associated data</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive">Delete Account</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose how you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <Label>Email Notifications</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch
                  checked={personalData.notifications.email}
                  onCheckedChange={(checked) => 
                    setPersonalData({
                      ...personalData, 
                      notifications: {...personalData.notifications, email: checked}
                    })
                  }
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <Label>SMS Notifications</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">Receive alerts via SMS</p>
                </div>
                <Switch
                  checked={personalData.notifications.sms}
                  onCheckedChange={(checked) => 
                    setPersonalData({
                      ...personalData, 
                      notifications: {...personalData.notifications, sms: checked}
                    })
                  }
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    <Label>Browser Notifications</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">Show notifications in browser</p>
                </div>
                <Switch
                  checked={personalData.notifications.browser}
                  onCheckedChange={(checked) => 
                    setPersonalData({
                      ...personalData, 
                      notifications: {...personalData.notifications, browser: checked}
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage your account security and authentication</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    <Label>Two-Factor Authentication</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={personalData.security.twoFactor ? "default" : "secondary"}>
                    {personalData.security.twoFactor ? "Enabled" : "Disabled"}
                  </Badge>
                  <Button variant="outline" size="sm">
                    {personalData.security.twoFactor ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Password</Label>
                  <p className="text-sm text-muted-foreground">Last changed 3 months ago</p>
                </div>
                <Button variant="outline" size="sm">Change Password</Button>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Active Sessions</Label>
                  <p className="text-sm text-muted-foreground">{personalData.security.sessions} active sessions</p>
                </div>
                <Button variant="outline" size="sm">Manage Sessions</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization Settings (Admin Only) */}
        {isAdmin && (
          <>
            <TabsContent value="organization" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Organization Information</CardTitle>
                  <CardDescription>Manage your organization settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="orgName">Organization Name</Label>
                    <Input
                      id="orgName"
                      value={orgData.name}
                      onChange={(e) => setOrgData({...orgData, name: e.target.value})}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Current Plan</Label>
                      <p className="text-sm text-muted-foreground">
                        {orgData.plan} Plan - {orgData.seats.used}/{orgData.seats.total} seats used
                      </p>
                    </div>
                    <Badge variant="default">{orgData.plan}</Badge>
                  </div>
                  
                  <Button>Save Changes</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-destructive flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Organization Danger Zone
                  </CardTitle>
                  <CardDescription>Permanently delete this organization</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="destructive">Delete Organization</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="team" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>Manage your team members and their roles</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">
                        {orgData.seats.used}/{orgData.seats.total} seats used
                      </p>
                    </div>
                    <Button>Invite Member</Button>
                  </div>
                  
                  <div className="space-y-4">
                    {isDev ? (
                      <>
                        <p className="text-xs text-muted-foreground italic">Mock data (dev only)</p>
                        {mockMembers.map((member) => (
                          <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{member.name}</p>
                                  {member.role === 'admin' && <Crown className="h-3 w-3 text-yellow-500" />}
                                </div>
                                <p className="text-sm text-muted-foreground">{member.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="capitalize">{member.role}</Badge>
                              {member.role !== 'admin' && (
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No members yet</p>
                        <p className="text-sm">Invite team members to get started</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Billing & Subscription</CardTitle>
                  <CardDescription>Manage your subscription and billing information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{orgData.plan} Plan</p>
                      <p className="text-sm text-muted-foreground">
                        ${orgData.billing.amount}/month • Next billing: {orgData.billing.nextBilling}
                      </p>
                    </div>
                    <Badge variant={orgData.billing.status === 'active' ? 'default' : 'destructive'}>
                      {orgData.billing.status}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button>Manage Subscription</Button>
                    <Button variant="outline">Upgrade Plan</Button>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <Label>Usage This Month</Label>
                    <div className="mt-2 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Agents Created</span>
                        <span>3/5</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Calls Made</span>
                        <span>847/1,000</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Storage Used</span>
                        <span>18GB/25GB</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}