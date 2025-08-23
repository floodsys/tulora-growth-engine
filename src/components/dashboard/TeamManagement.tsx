import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { OrganizationRole } from "@/hooks/useOrganizationRole";
import { Plus, Mail, Users, UserCheck, Clock, X, ToggleLeft, ToggleRight } from "lucide-react";

interface TeamMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: OrganizationRole;
  seat_active: boolean;
  created_at: string;
  profiles?: {
    full_name?: string;
    email?: string;
    avatar_url?: string;
  };
}

interface PendingInvite {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationRole;
  status: string;
  expires_at: string;
  created_at: string;
}

function TeamMembersTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrganizationRole>('user');

  // Mock organization ID - in real app, get from context/props
  const organizationId = "mock-org-id";

  useEffect(() => {
    fetchTeamData();
  }, []);

  const fetchTeamData = async () => {
    try {
      // Fetch team members - mock data for now since tables may not exist yet
      const mockMembers: TeamMember[] = [
        {
          id: "1",
          user_id: "user1",
          organization_id: organizationId,
          role: "admin",
          seat_active: true,
          created_at: new Date().toISOString(),
          profiles: {
            full_name: "John Doe",
            email: "john@example.com",
            avatar_url: ""
          }
        },
        {
          id: "2", 
          user_id: "user2",
          organization_id: organizationId,
          role: "editor",
          seat_active: true,
          created_at: new Date().toISOString(),
          profiles: {
            full_name: "Jane Smith",
            email: "jane@example.com",
            avatar_url: ""
          }
        }
      ];

      // Fetch pending invites - mock data for now
      const mockInvites: PendingInvite[] = [
        {
          id: "invite1",
          organization_id: organizationId,
          email: "newuser@example.com",
          role: "viewer",
          status: "pending",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString()
        }
      ];

      setMembers(mockMembers);
      setInvites(mockInvites);
    } catch (error) {
      console.error('Error fetching team data:', error);
      toast({
        title: "Error",
        description: "Failed to load team data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    try {
      // For demo purposes, add to mock invites
      const newInvite: PendingInvite = {
        id: `invite-${Date.now()}`,
        organization_id: organizationId,
        email: inviteEmail.trim(),
        role: inviteRole,
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString()
      };

      setInvites(prev => [...prev, newInvite]);

      toast({
        title: "Invite sent",
        description: `Invitation sent to ${inviteEmail}`,
      });

      setInviteEmail('');
      setInviteRole('user');
    } catch (error) {
      console.error('Error sending invite:', error);
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive",
      });
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      // For demo purposes, remove from invites and add to members
      const invite = invites.find(i => i.id === inviteId);
      if (!invite) return;

      const newMember: TeamMember = {
        id: `member-${Date.now()}`,
        user_id: `user-${Date.now()}`,
        organization_id: organizationId,
        role: invite.role,
        seat_active: true,
        created_at: new Date().toISOString(),
        profiles: {
          full_name: "New Member",
          email: invite.email,
          avatar_url: ""
        }
      };

      setMembers(prev => [...prev, newMember]);
      setInvites(prev => prev.filter(i => i.id !== inviteId));

      toast({
        title: "Invite accepted",
        description: "You have joined the team",
      });
    } catch (error) {
      console.error('Error accepting invite:', error);
      toast({
        title: "Error",
        description: "Failed to accept invitation",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      setMembers(prev => prev.filter(m => m.id !== memberId));

      toast({
        title: "Member removed",
        description: "Team member has been removed",
      });
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  const handleToggleSeat = async (memberId: string, currentStatus: boolean) => {
    try {
      setMembers(prev => prev.map(m => 
        m.id === memberId ? { ...m, seat_active: !currentStatus } : m
      ));

      toast({
        title: "Seat updated",
        description: `Seat ${!currentStatus ? 'activated' : 'deactivated'}`,
      });
    } catch (error) {
      console.error('Error toggling seat:', error);
      toast({
        title: "Error",
        description: "Failed to update seat status",
        variant: "destructive",
      });
    }
  };

  const formatRole = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const totalMembers = members.length;
  const activeSeats = members.filter(m => m.seat_active).length;
  const pendingInvites = invites.length;

  if (loading) {
    return <div className="p-4">Loading team data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Team Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMembers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Active Seats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSeats}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Invites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingInvites}</div>
          </CardContent>
        </Card>
      </div>

      {/* Invite Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invite Team Member
          </CardTitle>
          <CardDescription>
            Send an invitation to add a new member to your team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as OrganizationRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleInvite} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Send Invitation
          </Button>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>
              Invitations waiting to be accepted
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{formatRole(invite.role)}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(invite.expires_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
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
          <CardDescription>
            Manage your team members and their permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Seat Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.profiles?.avatar_url} />
                        <AvatarFallback>
                          {member.profiles?.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {member.profiles?.full_name || 'Unknown User'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {member.profiles?.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                      {formatRole(member.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleSeat(member.id, member.seat_active)}
                      >
                        {member.seat_active ? (
                          <ToggleRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <span className={`text-sm ${member.seat_active ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {member.seat_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(member.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>
          Manage user accounts and permissions across your organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          User management features coming soon...
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationOptionsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Notifications</CardTitle>
        <CardDescription>
          Configure notification settings for your team
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          Notification settings coming soon...
        </div>
      </CardContent>
    </Card>
  );
}

function VariablesTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Variables</CardTitle>
        <CardDescription>
          Manage team-wide variables and configuration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          Variable management coming soon...
        </div>
      </CardContent>
    </Card>
  );
}

export function TeamManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Team Management</h1>
        <p className="text-muted-foreground mb-6">
          Manage your team members, roles, and permissions
        </p>
        
        <Tabs defaultValue="team" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-muted/50">
            <TabsTrigger value="team" className="text-xs">TEAM</TabsTrigger>
            <TabsTrigger value="users" className="text-xs">USERS</TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs">NOTIFICATION OPTIONS</TabsTrigger>
            <TabsTrigger value="variables" className="text-xs">VARIABLES</TabsTrigger>
          </TabsList>
          
          <TabsContent value="team" className="mt-6">
            <TeamMembersTab />
          </TabsContent>
          
          <TabsContent value="users" className="mt-6">
            <UsersTab />
          </TabsContent>
          
          <TabsContent value="notifications" className="mt-6">
            <NotificationOptionsTab />
          </TabsContent>
          
          <TabsContent value="variables" className="mt-6">
            <VariablesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}