import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Crown, UserCheck } from "lucide-react";

interface TransferOwnershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  availableMembers: Array<{
    id: string;
    user_id: string;
    profiles?: {
      full_name?: string;
      email?: string;
    };
  }>;
  onTransferComplete?: () => void;
}

export function TransferOwnershipDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  availableMembers,
  onTransferComplete
}: TransferOwnershipDialogProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [keepAsAdmin, setKeepAsAdmin] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const { toast } = useToast();

  const handleTransfer = async () => {
    if (!selectedMemberId) {
      toast({
        title: "Error",
        description: "Please select a member to transfer ownership to",
        variant: "destructive",
      });
      return;
    }

    setTransferring(true);
    try {
      const { data, error } = await supabase.rpc('transfer_organization_ownership', {
        p_org_id: organizationId,
        p_new_owner_user_id: selectedMemberId,
        p_keep_old_owner_as_admin: keepAsAdmin
      });

      if (error) throw error;

      if ((data as any)?.success) {
        toast({
          title: "Ownership transferred",
          description: "Organization ownership has been successfully transferred",
        });
        
        onTransferComplete?.();
        onOpenChange(false);
        setSelectedMemberId('');
      } else {
        throw new Error((data as any)?.error || 'Failed to transfer ownership');
      }
    } catch (error) {
      console.error('Error transferring ownership:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to transfer ownership",
        variant: "destructive",
      });
    } finally {
      setTransferring(false);
    }
  };

  const selectedMember = availableMembers.find(m => m.user_id === selectedMemberId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Transfer Ownership
          </DialogTitle>
          <DialogDescription>
            Transfer ownership of <strong>{organizationName}</strong> to another team member.
            This action is permanent and will give the selected member full control over the organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="member-select">Select New Owner</Label>
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a team member" />
              </SelectTrigger>
              <SelectContent>
                {availableMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      <span>
                        {member.profiles?.full_name || member.profiles?.email || 'Unknown User'}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="keep-admin"
              checked={keepAsAdmin}
              onCheckedChange={setKeepAsAdmin}
            />
            <Label htmlFor="keep-admin" className="text-sm">
              Keep me as an admin after transfer
            </Label>
          </div>

          {selectedMember && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Transfer Summary</h4>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-muted-foreground">New Owner:</span>{' '}
                  <Badge variant="default">
                    {selectedMember.profiles?.full_name || selectedMember.profiles?.email}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Your new role:</span>{' '}
                  <Badge variant={keepAsAdmin ? "secondary" : "outline"}>
                    {keepAsAdmin ? "Admin" : "No role"}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleTransfer}
            disabled={!selectedMemberId || transferring}
            className="bg-destructive hover:bg-destructive/90"
          >
            {transferring ? "Transferring..." : "Transfer Ownership"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}