import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { 
  Users, 
  UserPlus, 
  UserMinus, 
  Crown, 
  Shield, 
  User,
  Mail,
  CheckCircle,
  XCircle,
  Bell,
  Settings
} from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { acceptInvitation, removeMember, toggleSeatActive } from "@/lib/billing-hooks"

interface TeamMember {
  user_id: string
  org_id: string
  role: string | null
  seat_active: boolean | null
  email?: string
  full_name?: string
  status?: string
}

interface PendingInvite {
  id: string
  organization_id: string
  user_id: string | null
  role: string
  status: string
  created_at: string
  email?: string
}

const TeamMembersTab = () => {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const { toast } = useToast()

  // TODO: Get actual org ID from context/auth
  const currentOrgId = "temp-org-id"

  useEffect(() => {
    fetchTeamData()
  }, [currentOrgId])

  const fetchTeamData = async () => {
    try {
      setIsLoading(true)

      // Fetch organization members with profile data
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select(`
          *,
          profiles:user_id (
            email,
            full_name
          )
        `)
        .eq('org_id', currentOrgId)

      if (membersError) throw membersError

      // Fetch pending invitations
      const { data: invitesData, error: invitesError } = await supabase
        .from('memberships')
        .select('*')
        .eq('organization_id', currentOrgId)
        .eq('status', 'pending')

      if (invitesError) throw invitesError

      setMembers(membersData || [])
      setPendingInvites(invitesData || [])
    } catch (error: any) {
      toast({
        title: "Error loading team data",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAcceptInvite = async (membershipId: string) => {
    const result = await acceptInvitation(membershipId, currentOrgId)
    if (result.success) {
      await fetchTeamData() // Refresh data
    }
  }

  const handleRemoveMember = async (userId: string) => {
    const result = await removeMember(userId, currentOrgId)
    if (result.success) {
      await fetchTeamData() // Refresh data
    }
  }

  const handleToggleSeat = async (userId: string, currentStatus: boolean) => {
    const result = await toggleSeatActive(userId, currentOrgId, !currentStatus)
    if (result.success) {
      await fetchTeamData() // Refresh data
    }
  }

  const getRoleIcon = (role: string | null) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-warning" />
      case 'admin':
        return <Shield className="h-4 w-4 text-primary" />
      default:
        return <User className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case 'owner':
        return <Badge variant="secondary" className="bg-warning text-warning-foreground">Owner</Badge>
      case 'admin':
        return <Badge variant="secondary" className="bg-primary text-primary-foreground">Admin</Badge>
      default:
        return <Badge variant="outline">Member</Badge>
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading team data...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Team Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Seats</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {members.filter(m => m.seat_active).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
            <Mail className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingInvites.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Invite Member */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Member
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button>
            <Mail className="h-4 w-4 mr-2" />
            Send Invitation
          </Button>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email || 'N/A'}</TableCell>
                    <TableCell>{getRoleBadge(invite.role)}</TableCell>
                    <TableCell>
                      {new Date(invite.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        onClick={() => handleAcceptInvite(invite.id)}
                      >
                        Accept
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Seat Status</TableHead>
                <TableHead>Active Seat</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getRoleIcon(member.role)}
                      <div>
                        <div className="font-medium">
                          {(member as any).profiles?.full_name || 'Unknown User'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {(member as any).profiles?.email || 'No email'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getRoleBadge(member.role)}</TableCell>
                  <TableCell>
                    {member.seat_active ? (
                      <Badge variant="secondary" className="bg-success text-success-foreground">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={member.seat_active || false}
                      onCheckedChange={() => handleToggleSeat(member.user_id, member.seat_active || false)}
                      disabled={member.role === 'owner'} // Owners always have active seats
                    />
                  </TableCell>
                  <TableCell>
                    {member.role !== 'owner' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <UserMinus className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove this member from the organization? 
                              This action cannot be undone and will automatically update your seat count.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleRemoveMember(member.user_id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Remove Member
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

const UsersTab = () => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Individual user account management coming soon...</p>
      </CardContent>
    </Card>
  </div>
)

const NotificationOptionsTab = () => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Team Notification Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Team-wide notification preferences coming soon...</p>
      </CardContent>
    </Card>
  </div>
)

const VariablesTab = () => (
  <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Team Variables
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Shared team variables and configuration coming soon...</p>
      </CardContent>
    </Card>
  </div>
)

export function TeamManagement() {
  return (
    <div className="h-full max-h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">My Team</h1>
        <p className="text-muted-foreground">Manage your team members and settings</p>
      </div>
      
      <Tabs defaultValue="team" className="h-full flex flex-col">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="team">TEAM</TabsTrigger>
          <TabsTrigger value="users">USERS</TabsTrigger>
          <TabsTrigger value="notifications">NOTIFICATION OPTIONS</TabsTrigger>
          <TabsTrigger value="variables">VARIABLES</TabsTrigger>
        </TabsList>
        
        <TabsContent value="team" className="flex-1 mt-6">
          <TeamMembersTab />
        </TabsContent>
        
        <TabsContent value="users" className="flex-1 mt-6">
          <UsersTab />
        </TabsContent>
        
        <TabsContent value="notifications" className="flex-1 mt-6">
          <NotificationOptionsTab />
        </TabsContent>
        
        <TabsContent value="variables" className="flex-1 mt-6">
          <VariablesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}