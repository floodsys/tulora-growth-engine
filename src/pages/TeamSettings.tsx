import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { TeamAccessGuard } from "@/components/guards/TeamAccessGuard";
import { 
  Users, 
  UserPlus, 
  Mail, 
  MoreHorizontal, 
  Trash2,
  Crown,
  Clock,
  CheckCircle,
  XCircle,
  Copy
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TeamMember {
  id: string;
  user_id: string;
  role: 'admin' | 'editor' | 'viewer' | 'user';
  seat_active: boolean;
  created_at: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer' | 'user';
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
}

export default function TeamSettings() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<{
    email: string;
    role: 'admin' | 'editor' | 'viewer' | 'user';
  }>({
    email: "",
    role: "user",
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  
  const { toast } = useToast();
  const { organizationId, isOwner } = useUserOrganization();
  const { isAdmin } = useOrganizationRole(organizationId || undefined);

  const canManageTeam = isOwner || isAdmin;

  useEffect(() => {
    if (organizationId) {
      loadTeamData();
    }
  }, [organizationId]);

  const loadTeamData = async () => {
    if (!organizationId) return;

    try {
      setLoading(true);

      // Load team members
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select(`
          id,
          user_id,
          role,
          seat_active,
          created_at
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (membersError) throw membersError;

      // Load pending invites
      const { data: invitesData, error: invitesError } = await supabase
        .from('organization_invitations')
        .select('id, email, role, status, created_at, expires_at')
        .eq('organization_id', organizationId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (invitesError) throw invitesError;

      setMembers(membersData || []);
      setInvites(invitesData || []);
    } catch (error) {
      console.error('Error loading team data:', error);
      toast({
        title: "Error",
        description: "Failed to load team data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!organizationId || !canManageTeam) return;
    if (!inviteForm.email.trim()) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }

    setInviteLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-invite-with-limits', {
        body: {
          organizationId,
          email: inviteForm.email.trim(),
          role: inviteForm.role,
        }
      });

      if (error) throw error;

      toast({
        title: "Invitation sent",
        description: `Invitation sent to ${inviteForm.email}`,
      });

      setInviteForm({ email: "", role: "user" });
      setInviteModalOpen(false);
      loadTeamData(); // Refresh the list
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'editor' | 'viewer' | 'user') => {
    if (!canManageTeam) return;

    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Role updated",
        description: "Member role has been updated successfully",
      });

      loadTeamData();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update member role",
        variant: "destructive",
      });
    }
  };

  const handleSeatToggle = async (memberId: string, currentActive: boolean) => {
    if (!canManageTeam) return;

    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ seat_active: !currentActive })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: currentActive ? "Seat deactivated" : "Seat activated",
        description: `Member seat has been ${currentActive ? 'deactivated' : 'activated'}`,
      });

      loadTeamData();
    } catch (error) {
      console.error('Error toggling seat:', error);
      toast({
        title: "Error",
        description: "Failed to toggle member seat",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!canManageTeam) return;

    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Member removed",
        description: "Team member has been removed successfully",
      });

      loadTeamData();
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: "Error",
        description: "Failed to remove team member",
        variant: "destructive",
      });
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!canManageTeam) return;

    try {
      const { error } = await supabase
        .from('organization_invitations')
        .update({ status: 'expired' })
        .eq('id', inviteId);

      if (error) throw error;

      toast({
        title: "Invitation cancelled",
        description: "Invitation has been cancelled",
      });

      loadTeamData();
    } catch (error) {
      console.error('Error cancelling invite:', error);
      toast({
        title: "Error", 
        description: "Failed to cancel invitation",
        variant: "destructive",
      });
    }
  };

  const copyInviteLink = (inviteId: string) => {
    const inviteUrl = `${window.location.origin}/invite/accept?token=${inviteId}`;
    navigator.clipboard.writeText(inviteUrl);
    toast({
      title: "Link copied",
      description: "Invitation link copied to clipboard",
    });
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'editor': return 'default';
      case 'viewer': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <TeamAccessGuard>
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6" />
              <h1 className="text-2xl font-semibold">Team Management</h1>
            </div>
            
            {canManageTeam && (
              <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation to add a new member to your team.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleInviteSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="colleague@company.com"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={inviteForm.role}
                        onValueChange={(value: 'admin' | 'editor' | 'viewer' | 'user') => setInviteForm(prev => ({ ...prev, role: value }))}
                      >
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

                    <div className="flex gap-2 pt-4">
                      <Button type="submit" disabled={inviteLoading} className="flex-1">
                        {inviteLoading ? "Sending..." : "Send Invitation"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setInviteModalOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Team Members */}
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Manage your team members, their roles, and seat assignments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div>Loading team members...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Seat Status</TableHead>
                      <TableHead>Joined</TableHead>
                      {canManageTeam && <TableHead className="w-[50px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                Member {member.user_id.slice(0, 8)}
                              </span>
                              {isOwner && member.user_id === organizationId && (
                                <Crown className="h-4 w-4 text-yellow-500" />
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              User ID: {member.user_id}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {canManageTeam ? (
                            <Select
                              value={member.role}
                              onValueChange={(value: 'admin' | 'editor' | 'viewer' | 'user') => handleRoleChange(member.id, value)}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={getRoleBadgeVariant(member.role)}>
                              {member.role}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {canManageTeam ? (
                              <Switch
                                checked={member.seat_active}
                                onCheckedChange={() => handleSeatToggle(member.id, member.seat_active)}
                              />
                            ) : (
                              <Badge variant={member.seat_active ? "default" : "secondary"}>
                                {member.seat_active ? "Active" : "Inactive"}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {new Date(member.created_at).toLocaleDateString()}
                          </span>
                        </TableCell>
                        {canManageTeam && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove Member
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          {invites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Pending Invitations
                </CardTitle>
                <CardDescription>
                  Invitations that have been sent but not yet accepted.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Expires</TableHead>
                      {canManageTeam && <TableHead className="w-[100px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-orange-500" />
                            {invite.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(invite.role)}>
                            {invite.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {new Date(invite.created_at).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {new Date(invite.expires_at).toLocaleDateString()}
                          </span>
                        </TableCell>
                        {canManageTeam && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyInviteLink(invite.id)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelInvite(invite.id)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </TeamAccessGuard>
  );
}