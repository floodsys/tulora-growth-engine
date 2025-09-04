import { useState, useEffect } from 'react';
import { Plus, Trash2, Shield, AlertTriangle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { DestructiveActionDialog } from './DestructiveActionDialog';
import { supabase } from '@/integrations/supabase/client';
import { useSuperadmin } from '@/hooks/useSuperadmin';
import { useToast } from '@/hooks/use-toast';

interface Superadmin {
  user_id: string;
  email?: string;
  added_by: string;
  created_at: string;
}

export function SuperadminManagement() {
  const [superadmins, setSuperadmins] = useState<Superadmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedSuperadmin, setSelectedSuperadmin] = useState<Superadmin | null>(null);
  
  const { addSuperadmin, removeSuperadmin } = useSuperadmin();
  const { toast } = useToast();

  useEffect(() => {
    loadSuperadmins();
  }, []);

  const loadSuperadmins = async () => {
    try {
      setLoading(true);
      
      // Get superadmins with user details
      const { data: superadminData, error: superadminError } = await supabase
        .from('superadmins')
        .select(`
          user_id,
          added_by,
          created_at
        `);

      if (superadminError) throw superadminError;

      // Get user emails from auth.users via profiles table or direct RPC
      const userIds = superadminData?.map(s => s.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.email]) || []);

      const superadminsWithEmails = (superadminData || []).map(admin => ({
        ...admin,
        email: profileMap.get(admin.user_id) || 'Unknown'
      }));

      setSuperadmins(superadminsWithEmails);
    } catch (error) {
      console.error('Error loading superadmins:', error);
      toast({
        title: "Error",
        description: "Failed to load superadmins.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSuperadmin = async () => {
    if (!newEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsAddingUser(true);

    try {
      const result = await addSuperadmin(newEmail.trim());
      
      if (result.success) {
        toast({
          title: "Success",
          description: "User successfully added as superadmin.",
        });
        setNewEmail('');
        await loadSuperadmins();
      } else {
        toast({
          title: "Failed to add superadmin",
          description: result.error || "An error occurred.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleRemoveSuperadmin = async (reason: string) => {
    if (!selectedSuperadmin) return;

    try {
      const result = await removeSuperadmin(selectedSuperadmin.email || '');
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Superadmin access removed successfully.",
        });
        await loadSuperadmins();
      } else {
        toast({
          title: "Failed to remove superadmin",
          description: result.error || "An error occurred.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Superadmin Management
          </CardTitle>
          <CardDescription>
            Manage platform administrators who have access to the admin dashboard.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Superadmins have full platform access and can suspend organizations, 
              transfer ownership, and access all admin utilities. Grant this access carefully.
            </AlertDescription>
          </Alert>

          {/* Add New Superadmin */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Add New Superadmin</h3>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="email" className="sr-only">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isAddingUser) {
                      handleAddSuperadmin();
                    }
                  }}
                />
              </div>
              <Button 
                onClick={handleAddSuperadmin}
                disabled={isAddingUser || !newEmail.trim()}
              >
                <Plus className="h-4 w-4 mr-2" />
                {isAddingUser ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>

          {/* Current Superadmins */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Current Superadmins</h3>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {superadmins.length} total
              </Badge>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-muted-foreground">Loading superadmins...</div>
              </div>
            ) : superadmins.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No superadmins found
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {superadmins.map((admin) => (
                      <TableRow key={admin.user_id}>
                        <TableCell className="font-medium">
                          {admin.email}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(admin.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSuperadmin(admin);
                              setRemoveDialogOpen(true);
                            }}
                            className="text-destructive hover:text-destructive"
                            disabled={superadmins.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {superadmins.length <= 1 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You cannot remove the last superadmin. Add another superadmin before removing this one.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Remove Superadmin Dialog */}
      {selectedSuperadmin && (
        <DestructiveActionDialog
          isOpen={removeDialogOpen}
          onOpenChange={setRemoveDialogOpen}
          title="Remove Superadmin"
          description="This will remove superadmin access from the selected user. They will no longer be able to access the admin dashboard or perform administrative actions."
          actionName="remove_superadmin"
          targetType="superadmin"
          targetId={selectedSuperadmin.user_id}
          confirmationText={`REMOVE SUPERADMIN ${selectedSuperadmin.email}`}
          dangerLevel="high"
          onConfirm={handleRemoveSuperadmin}
          estimatedTime="< 1 minute"
        />
      )}
    </div>
  );
}