import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  MoreHorizontal, 
  UserCheck, 
  UserX, 
  Trash2, 
  KeyRound,
  Mail,
  RefreshCw,
  Download,
  Shield
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Member {
  user_id: string;
  email: string;
  organization_id: string;
  organization_name: string;
  role: string;
  seat_active: boolean;
  joined_at: string;
  last_activity: string;
}

interface ActionConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  loading: boolean;
}

function ActionConfirmDialog({ open, onOpenChange, title, description, onConfirm, loading }: ActionConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MembersAdmin() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    action: () => {}
  });

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('admin_get_all_members', {
        p_search_email: searchQuery || null,
        p_limit: 200
      });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error loading members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load members',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter(member => 
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.organization_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [members, searchQuery]);

  const handleRoleChange = async (member: Member, newRole: string) => {
    try {
      setActionLoading(true);
      const { data, error } = await supabase.rpc('admin_change_member_role', {
        p_organization_id: member.organization_id,
        p_user_id: member.user_id,
        p_new_role: newRole as 'admin' | 'editor' | 'viewer' | 'user'
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; old_role?: string; new_role?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to change role');
      }

      toast({
        title: 'Success',
        description: `Role changed from ${result.old_role} to ${result.new_role}`,
      });

      await loadMembers();
    } catch (error) {
      console.error('Error changing role:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to change role',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSeatToggle = async (member: Member) => {
    const action = member.seat_active ? 'deactivate' : 'activate';
    setConfirmDialog({
      open: true,
      title: `${action === 'activate' ? 'Activate' : 'Deactivate'} Seat`,
      description: `Are you sure you want to ${action} ${member.email}'s seat in ${member.organization_name}?`,
      action: async () => {
        try {
          setActionLoading(true);
          const { data, error } = await supabase.rpc('admin_toggle_member_seat', {
            p_organization_id: member.organization_id,
            p_user_id: member.user_id,
            p_seat_active: !member.seat_active
          });

          if (error) throw error;

          const result = data as { success: boolean; error?: string; old_status?: boolean; new_status?: boolean };
          if (!result.success) {
            throw new Error(result.error || 'Failed to toggle seat');
          }

          toast({
            title: 'Success',
            description: `Seat ${member.seat_active ? 'deactivated' : 'activated'} successfully`,
          });

          await loadMembers();
          setConfirmDialog({ ...confirmDialog, open: false });
        } catch (error) {
          console.error('Error toggling seat:', error);
          toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to toggle seat',
            variant: 'destructive'
          });
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleRemoveMember = async (member: Member) => {
    setConfirmDialog({
      open: true,
      title: 'Remove Member',
      description: `Are you sure you want to remove ${member.email} from ${member.organization_name}? This action cannot be undone.`,
      action: async () => {
        try {
          setActionLoading(true);
          const { data, error } = await supabase.rpc('admin_remove_member', {
            p_organization_id: member.organization_id,
            p_user_id: member.user_id
          });

          if (error) throw error;

          const result = data as { success: boolean; error?: string; removed_user_id?: string; removed_role?: string };
          if (!result.success) {
            throw new Error(result.error || 'Failed to remove member');
          }

          toast({
            title: 'Success',
            description: `${member.email} removed from ${member.organization_name}`,
          });

          await loadMembers();
          setConfirmDialog({ ...confirmDialog, open: false });
        } catch (error) {
          console.error('Error removing member:', error);
          toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to remove member',
            variant: 'destructive'
          });
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handlePasswordReset = async (member: Member) => {
    // This would need to be implemented based on your auth provider
    toast({
      title: 'Password Reset',
      description: 'Password reset functionality would be implemented here',
    });
  };

  const handleSendInvite = async (member: Member) => {
    // This would redirect to invite flow
    toast({
      title: 'Send Invite',
      description: 'Invite functionality would be implemented here',
    });
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-800',
      editor: 'bg-blue-100 text-blue-800',
      viewer: 'bg-green-100 text-green-800',
      user: 'bg-gray-100 text-gray-800'
    };
    return (
      <Badge className={colors[role] || 'bg-gray-100 text-gray-800'}>
        {role}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Members Directory</span>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMembers}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by email or organization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Email</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Seat Active</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => (
                <TableRow key={`${member.user_id}-${member.organization_id}`}>
                  <TableCell className="font-medium">{member.email}</TableCell>
                  <TableCell>{member.organization_name}</TableCell>
                  <TableCell>
                    <Select
                      value={member.role}
                      onValueChange={(value) => handleRoleChange(member, value)}
                      disabled={actionLoading}
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
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Badge variant={member.seat_active ? 'default' : 'secondary'}>
                        {member.seat_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(member.last_activity), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleSeatToggle(member)}>
                          {member.seat_active ? (
                            <>
                              <UserX className="h-4 w-4 mr-2" />
                              Deactivate Seat
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-4 w-4 mr-2" />
                              Activate Seat
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePasswordReset(member)}>
                          <KeyRound className="h-4 w-4 mr-2" />
                          Force Password Reset
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSendInvite(member)}>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Invite
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleRemoveMember(member)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredMembers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No members found matching your criteria
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <ActionConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.action}
        loading={actionLoading}
      />
    </div>
  );
}