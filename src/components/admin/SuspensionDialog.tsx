import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Ban, Play, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SuspensionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  organization: {
    id: string;
    name: string;
    status?: string;
  };
  action?: 'suspend' | 'reinstate' | 'cancel';
  onSuccess?: () => void;
}

export function SuspensionDialog({ 
  isOpen, 
  onClose, 
  organization, 
  action,
  onSuccess 
}: SuspensionDialogProps) {
  const [reason, setReason] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [notifyOwner, setNotifyOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const isSuspended = organization.status === 'suspended';
  const isCanceled = organization.status === 'canceled';
  const currentAction = action || (isSuspended || isCanceled ? 'reinstate' : 'suspend');
  const expectedPhrase = `${currentAction.toUpperCase()} ORG ${organization.id}`;

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for this action.",
        variant: "destructive",
      });
      return;
    }

    if (confirmationPhrase !== expectedPhrase) {
      toast({
        title: "Confirmation required",
        description: `Please type "${expectedPhrase}" to confirm.`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase.functions.invoke('org-suspension', {
      body: {
        action: currentAction,
        org_id: organization.id,
        reason,
        confirmation_phrase: confirmationPhrase,
        notify_owner: notifyOwner
      }
    });

    if (error || !data?.success) {
      toast({
        title: "Action failed",
        description: data?.error || error?.message || "Failed to complete the action.",
        variant: "destructive",
      });
    } else {
      const actionMap = {
        suspend: 'suspended',
        cancel: 'canceled', 
        reinstate: 'reinstated'
      };
      toast({
        title: "Success",
        description: `Organization ${actionMap[currentAction]} successfully.`,
      });
      setReason('');
      setConfirmationPhrase('');
      setNotifyOwner(false);
      onClose();
      onSuccess?.();
    }

    setIsLoading(false);
  };

  const isFormValid = reason.trim() && confirmationPhrase === expectedPhrase;
  
  const getTitle = () => {
    if (currentAction === 'cancel') return 'Cancel Organization Service';
    if (currentAction === 'suspend') return 'Suspend Organization Service';
    return 'Reinstate Organization Service';
  };
  
  const getDescription = () => {
    if (currentAction === 'cancel') {
      return 'This will cancel the organization service permanently. All operations will be blocked except billing portal access. This action is typically used for organizations that have terminated their contract.';
    }
    if (currentAction === 'suspend') {
      return 'This will temporarily suspend organization services. Agents, API access, and invites will be blocked. Billing portal and read-only settings remain accessible.';
    }
    return 'This will reinstate the organization and restore all services to full functionality.';
  };

  const getIcon = () => {
    if (currentAction === 'cancel') return <XCircle className="h-5 w-5 text-destructive" />;
    if (currentAction === 'suspend') return <Ban className="h-5 w-5 text-warning" />;
    return <Play className="h-5 w-5 text-success" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
          <DialogDescription>
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        {currentAction === 'cancel' && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This is a permanent action that will completely disable all organization services. Only use for terminated contracts.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">
              Reason for {currentAction}
            </Label>
            <Textarea
              id="reason"
              placeholder={`Why are you ${currentAction === 'reinstate' ? 'reinstating' : currentAction + 'ing'} this organization?`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirmation">
              Type "{expectedPhrase}" to confirm
            </Label>
            <Input
              id="confirmation"
              value={confirmationPhrase}
              onChange={(e) => setConfirmationPhrase(e.target.value)}
              placeholder={expectedPhrase}
              className="font-mono text-sm"
            />
          </div>

          {currentAction !== 'reinstate' && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify"
                checked={notifyOwner}
                onCheckedChange={(checked) => setNotifyOwner(checked as boolean)}
              />
              <Label htmlFor="notify" className="text-sm">
                Notify organization owner via email
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isLoading}
            className="w-full"
            variant={currentAction === 'reinstate' ? 'default' : 'destructive'}
          >
            {isLoading ? "Processing..." : `${currentAction === 'reinstate' ? 'Reinstate' : currentAction === 'cancel' ? 'Cancel' : 'Suspend'} Organization`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}