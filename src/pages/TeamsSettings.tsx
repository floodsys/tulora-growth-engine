import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizationRole, OrganizationRole } from "@/hooks/useOrganizationRole";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Plus, Mail, Users, UserCheck, Clock, X, Copy, Ban, Shield, ArrowLeft } from "lucide-react";

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
  invite_token: string;
  invited_by?: string;
}

function TeamsSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrganizationRole>('viewer');
  const [emailError, setEmailError] = useState('');
  const [inviting, setInviting] = useState(false);

  const { organizationId, isOwner, loading: orgLoading } = useUserOrganization();
  const { isAdmin, loading: roleLoading } = useOrganizationRole(organizationId || undefined);

  useEffect(() => {
    // Redirect non-admins and non-owners
    if (!orgLoading && !roleLoading && !isAdmin && !isOwner) {
      navigate('/dashboard');
      return;
    }

    if (!orgLoading && !roleLoading && (isAdmin || isOwner) && organizationId) {
      fetchTeamData();
    }
  }, [isAdmin, isOwner, roleLoading, orgLoading, organizationId, navigate]);

  const fetchTeamData = async () => {
    try {
      // Mock data for demonstration
      const mockMembers: TeamMember[] = [
        {
          id: "1",
          user_id: "user1",
          organization_id: organizationId || "",
          role: "admin",
          seat_active: true,
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          profiles: {
            full_name: "John Doe",
            email: "john@example.com",
            avatar_url: ""
          }
        },
        {
          id: "2", 
          user_id: "user2",
          organization_id: organizationId || "",
          role: "editor",
          seat_active: true,
          created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          profiles: {
            full_name: "Jane Smith",
            email: "jane@example.com",
            avatar_url: ""
          }
        },
        {
          id: "3",
          user_id: "user3", 
          organization_id: organizationId || "",
          role: "viewer",
          seat_active: false,
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          profiles: {
            full_name: "Bob Wilson",
            email: "bob@example.com",
            avatar_url: ""
          }
        }
      ];

      const mockInvites: PendingInvite[] = [
        {
          id: "invite1",
          organization_id: organizationId || "",
          email: "newuser@example.com",
          role: "viewer",
          status: "pending",
          expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          invite_token: "sample-token-123",
          invited_by: "user1"
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

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return "Email is required";
    }
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address";
    }
    
    // Check if user is already a member
    const existingMember = members.find(m => m.profiles?.email?.toLowerCase() === email.toLowerCase());
    if (existingMember) {
      return "This user is already a team member";
    }
    
    // Check if user already has a pending invite
    const existingInvite = invites.find(i => i.email.toLowerCase() === email.toLowerCase() && i.status === 'pending');
    if (existingInvite) {
      return "This user already has a pending invitation";
    }
    
    return "";
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    const error = validateEmail(email);
    
    if (error) {
      setEmailError(error);
      return;
    }

    setInviting(true);
    try {
      // Create mock invite for demonstration
      const newInvite: PendingInvite = {
        id: `invite-${Date.now()}`,
        organization_id: organizationId || "",
        email: email,
        role: inviteRole,
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        invite_token: `token-${Date.now()}`,
        invited_by: user?.id
      };

      setInvites(prev => [...prev, newInvite]);

      // Create invite link
      const inviteLink = `${window.location.origin}/invite/accept?token=${newInvite.invite_token}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(inviteLink);

      toast({
        title: "Invitation sent",
        description: `Invitation sent to ${email}. Link copied to clipboard!`,
      });

      setInviteEmail('');
      setInviteRole('viewer');
      setEmailError('');
    } catch (error) {
      console.error('Error sending invite:', error);
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const copyInviteLink = async (token: string) => {
    try {
      const inviteLink = `${window.location.origin}/invite/accept?token=${token}`;
      await navigator.clipboard.writeText(inviteLink);
      toast({
        title: "Link copied",
        description: "Invitation link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const revokeInvite = async (inviteId: string) => {
    try {
      setInvites(prev => prev.map(invite => 
        invite.id === inviteId 
          ? { ...invite, status: 'revoked' }
          : invite
      ).filter(invite => invite.status === 'pending'));

      toast({
        title: "Invitation revoked",
        description: "The invitation has been revoked",
      });
    } catch (error) {
      console.error('Error revoking invite:', error);
      toast({
        title: "Error",
        description: "Failed to revoke invitation",
        variant: "destructive",
      });
    }
  };

  const updateMemberRole = async (memberId: string, newRole: OrganizationRole) => {
    try {
      setMembers(prev => prev.map(member => 
        member.id === memberId 
          ? { ...member, role: newRole }
          : member
      ));

      toast({
        title: "Role updated",
        description: "Member role has been updated",
      });
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      setMembers(prev => prev.filter(member => member.id !== memberId));

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

  const formatRole = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const getRoleBadgeVariant = (role: OrganizationRole) => {
    switch (role) {
      case 'admin': return 'default';
      case 'editor': return 'secondary';
      case 'viewer': return 'outline';
      case 'user': return 'outline';
      default: return 'outline';
    }
  };

  if (orgLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin && !isOwner) {
    return null; // Will redirect in useEffect
  }

  const totalMembers = members.length;
  const activeSeats = members.filter(m => m.seat_active).length;
  const pendingInvites = invites.filter(i => i.status === 'pending').length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>

          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" />
              Team Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage your team members, roles, and permissions
            </p>
          </div>

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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={(e) => {
                      setInviteEmail(e.target.value);
                      if (emailError) setEmailError('');
                    }}
                    className={emailError ? 'border-destructive' : ''}
                  />
                  {emailError && (
                    <p className="text-sm text-destructive">{emailError}</p>
                  )}
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
                <div className="space-y-2">
                  <Label className="text-transparent">Action</Label>
                  <Button 
                    onClick={handleInvite} 
                    className="w-full"
                    disabled={inviting}
                  >
                    {inviting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Send Invite
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          {invites.filter(i => i.status === 'pending').length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Invitations</CardTitle>
                <CardDescription>
                  Invitations waiting to be accepted
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Invited By</TableHead>
                        <TableHead>Sent At</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invites.filter(i => i.status === 'pending').map((invite) => (
                        <TableRow key={invite.id}>
                          <TableCell className="font-medium">{invite.email}</TableCell>
                          <TableCell>
                            <Badge variant={getRoleBadgeVariant(invite.role)}>
                              {formatRole(invite.role)}
                            </Badge>
                          </TableCell>
                          <TableCell>You</TableCell>
                          <TableCell>
                            {new Date(invite.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {new Date(invite.expires_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyInviteLink(invite.invite_token)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => revokeInvite(invite.id)}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 p-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No team members yet</h3>
                  <p>Invite your first team member to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-10 w-10">
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
                            <Select
                              value={member.role}
                              onValueChange={(value) => updateMemberRole(member.id, value as OrganizationRole)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue>
                                  <Badge variant={getRoleBadgeVariant(member.role)}>
                                    {formatRole(member.role)}
                                  </Badge>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {new Date(member.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeMember(member.id)}
                              disabled={member.user_id === user?.id} // Can't remove yourself
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default TeamsSettings;