import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useOrganizationRole, OrganizationRole } from "@/hooks/useOrganizationRole";
import { Plus, Mail, Users, UserCheck, Clock, X, Copy, Ban, ArrowLeft, Trash2 } from "lucide-react";
import { useFreePlanLimits } from "@/hooks/useFreePlanLimits";
import { UpgradeModal } from "@/components/ui/UpgradeModal";
import { createInviteWithLimits } from "@/lib/freePlanUtils";

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

export default function SettingsTeams() {
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
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const { organizationId, isOwner, loading: orgLoading } = useUserOrganization();
  const { isAdmin, loading: roleLoading } = useOrganizationRole(organizationId || undefined);
  const { canAddTeamMember, hasPendingBilling } = useFreePlanLimits();

  useEffect(() => {
    if (!orgLoading && !roleLoading && organizationId) {
      fetchTeamData();
    }
  }, [roleLoading, orgLoading, organizationId]);

  const fetchTeamData = async () => {
    if (!organizationId) return;
    
    try {
      // Fetch members with user profile data
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', organizationId);

      if (membersError) throw membersError;

      // Fetch profile data for each member
      const memberProfiles = await Promise.all(
        (membersData || []).map(async (member) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email, avatar_url')
            .eq('id', member.user_id)
            .single();
          
          return {
            ...member,
            profiles: profile
          };
        })
      );

      setMembers(memberProfiles as TeamMember[]);

      // Fetch pending invites
      const { data: invitesData, error: invitesError } = await supabase
        .from('organization_invitations')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'pending');

      if (invitesError) throw invitesError;
      setInvites(invitesData || []);

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

    // Check free plan limits before inviting
    if (!canAddTeamMember) {
      setUpgradeModalOpen(true);
      return;
    }

    if (!organizationId) return;

    setInviting(true);
    try {
      const result = await createInviteWithLimits(organizationId, email, inviteRole);

      if (result?.success) {
        // Create invite link
        const inviteLink = `${window.location.origin}/invite/accept?token=${result.token}`;
        
        // Copy to clipboard
        await navigator.clipboard.writeText(inviteLink);

        toast({
          title: "Invitation sent",
          description: `Invitation sent to ${email}. Link copied to clipboard!`,
        });

        // Refresh data
        fetchTeamData();
        setInviteEmail('');
        setInviteRole('viewer');
        setEmailError('');
      } else {
        throw new Error('Failed to create invitation');
      }
    } catch (error) {
      console.error('Error sending invite:', error);
      
      if (error instanceof Error && error.message === 'UPGRADE_REQUIRED') {
        setUpgradeModalOpen(true);
        return;
      }
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invitation",
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
      const { error } = await supabase
        .from('organization_invitations')
        .update({ status: 'revoked' })
        .eq('id', inviteId);

      if (error) throw error;

      toast({
        title: "Invitation revoked",
        description: "The invitation has been revoked",
      });

      fetchTeamData();
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
      const { error } = await supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Role updated",
        description: "Member role has been updated",
      });

      fetchTeamData();
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
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Member removed",
        description: "Team member has been removed",
      });

      fetchTeamData();
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
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }


  const totalMembers = members.length;
  const activeSeats = members.filter(m => m.seat_active).length;
  const pendingInvites = invites.filter(i => i.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
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
                  disabled={inviting || !canAddTeamMember}
                >
                  {inviting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Sending...
                    </>
                  ) : !canAddTeamMember ? (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Upgrade to Add More
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

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Manage roles and permissions for your team members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {member.profiles?.full_name || member.profiles?.email || 'Unknown User'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {member.profiles?.email}
                        </div>
                      </div>
                    </TableCell>
                     <TableCell>
                       <Select
                         value={member.role}
                         onValueChange={(value) => updateMemberRole(member.id, value as OrganizationRole)}
                         disabled={member.user_id === user?.id} // Can't change own role
                       >
                         <SelectTrigger className="w-32">
                           <SelectValue />
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
                      <Badge variant={member.seat_active ? 'default' : 'secondary'}>
                        {member.seat_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                     <TableCell>
                       {member.user_id !== user?.id && (
                         <AlertDialog>
                           <AlertDialogTrigger asChild>
                             <Button variant="outline" size="sm">
                               <Trash2 className="h-4 w-4" />
                             </Button>
                           </AlertDialogTrigger>
                           <AlertDialogContent>
                             <AlertDialogHeader>
                               <AlertDialogTitle>Remove Member</AlertDialogTitle>
                               <AlertDialogDescription>
                                 Are you sure you want to remove {member.profiles?.full_name || member.profiles?.email} from the team? This action cannot be undone.
                               </AlertDialogDescription>
                             </AlertDialogHeader>
                             <AlertDialogFooter>
                               <AlertDialogCancel>Cancel</AlertDialogCancel>
                               <AlertDialogAction onClick={() => removeMember(member.id)}>
                                 Remove
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
          </div>
        </CardContent>
      </Card>
      
      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        limitType="team_cap"
        hasPendingBilling={hasPendingBilling}
      />
    </div>
  );
}