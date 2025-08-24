import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle } from 'lucide-react';

interface Member {
  user_id: string;
  email: string;
  role: string;
}

interface TransferOwnershipDialogProps {
  organizationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TransferOwnershipDialog({ 
  organizationId, 
  open, 
  onOpenChange, 
  onSuccess 
}: TransferOwnershipDialogProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(false);

  const expectedPhrase = `transfer ownership of ${organizationName}`;

  useEffect(() => {
    if (open && organizationId) {
      loadOrganizationData();
    }
  }, [open, organizationId]);

  const loadOrganizationData = async () => {
    if (!organizationId) return;

    try {
      // Get organization name
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();

      if (orgData) {
        setOrganizationName(orgData.name);
      }

      // Get organization members (excluding current owner)
      const { data: membersData } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          role,
          profiles!inner(email)
        `)
        .eq('organization_id', organizationId)
        .eq('seat_active', true);

      if (membersData) {
        const formattedMembers = membersData.map(member => ({
          user_id: member.user_id,
          email: (member.profiles as any)?.email || 'Unknown',
          role: member.role
        }));
        setMembers(formattedMembers);
      }
    } catch (error) {
      console.error('Error loading organization data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load organization data',
        variant: 'destructive'
      });
    }
  };

  const handleTransfer = async () => {
    if (!organizationId || !selectedMember) return;

    if (confirmationPhrase.toLowerCase() !== expectedPhrase.toLowerCase()) {
      toast({
        title: 'Confirmation Required',
        description: 'Please type the exact confirmation phrase',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);

      // Update organization owner
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ owner_user_id: selectedMember })
        .eq('id', organizationId);

      if (updateError) throw updateError;

      // Update new owner's role to admin if not already
      const { error: memberError } = await supabase
        .from('organization_members')
        .upsert({
          organization_id: organizationId,
          user_id: selectedMember,
          role: 'admin',
          seat_active: true
        }, {
          onConflict: 'organization_id,user_id'
        });

      if (memberError) throw memberError;

      // Log the ownership transfer
      await supabase.functions.invoke('activity-logger', {
        body: {
          organization_id: organizationId,
          action: 'org.ownership_transferred',
          target_type: 'organization',
          target_id: organizationId,
          metadata: {
            new_owner_id: selectedMember,
            transferred_by: 'admin',
            confirmation_phrase: confirmationPhrase
          }
        }
      });

      toast({
        title: 'Success',
        description: 'Organization ownership transferred successfully'
      });

      onSuccess();
    } catch (error) {
      console.error('Error transferring ownership:', error);
      toast({
        title: 'Error',
        description: 'Failed to transfer ownership',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedMember('');
    setConfirmationPhrase('');
    setMembers([]);
    setOrganizationName('');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Ownership</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This action will permanently transfer ownership of <strong>{organizationName}</strong> to another member.
              This cannot be undone.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="member-select">Select New Owner</Label>
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a member..." />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.email} ({member.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmation">
              Type <code className="text-sm bg-muted px-1 rounded">{expectedPhrase}</code> to confirm:
            </Label>
            <Input
              id="confirmation"
              value={confirmationPhrase}
              onChange={(e) => setConfirmationPhrase(e.target.value)}
              placeholder="Type confirmation phrase..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleTransfer}
            disabled={
              !selectedMember || 
              confirmationPhrase.toLowerCase() !== expectedPhrase.toLowerCase() ||
              loading
            }
          >
            {loading ? 'Transferring...' : 'Transfer Ownership'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}