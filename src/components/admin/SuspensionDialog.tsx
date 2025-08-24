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
import { AlertTriangle, Ban, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SuspensionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  organization: {
    id: string;
    name: string;
    suspension_status?: string;
  };
  onSuccess?: () => void;
}

export function SuspensionDialog({ 
  isOpen, 
  onClose, 
  organization, 
  onSuccess 
}: SuspensionDialogProps) {
  const [reason, setReason] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [notifyOwner, setNotifyOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const isSuspended = organization.suspension_status === 'suspended';
  const action = isSuspended ? 'reinstate' : 'suspend';
  const expectedPhrase = `${action.toUpperCase()} ORG ${organization.id}`;

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for this action",
        variant: "destructive",
      });
      return;
    }

    if (confirmationPhrase !== expectedPhrase) {
      toast({
        title: "Invalid confirmation",
        description: `Please type exactly: ${expectedPhrase}`,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      const { data, error } = await supabase.functions.invoke('org-suspension', {
        body: {
          action,
          org_id: organization.id,
          reason: reason.trim(),
          confirmation_phrase: confirmationPhrase,
          notify_owner: notifyOwner
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Operation failed');
      }

      toast({
        title: `Organization ${action}d`,
        description: `Successfully ${action}d ${organization.name}`,
      });

      onSuccess?.();
      onClose();
      
      // Reset form
      setReason('');
      setConfirmationPhrase('');
      setNotifyOwner(false);

    } catch (error: any) {
      console.error(`Error ${action}ing organization:`, error);
      toast({
        title: `Failed to ${action} organization`,
        description: error.message || `An error occurred while ${action}ing the organization`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSuspended ? (
              <><Play className="h-5 w-5 text-green-600" />Reinstate Organization</>
            ) : (
              <><Ban className="h-5 w-5 text-red-600" />Suspend Organization</>
            )}
          </DialogTitle>
          <DialogDescription>
            {isSuspended 
              ? `Restore full access to ${organization.name}. This will re-enable agents, API access, and invitations.`
              : `Suspend ${organization.name}. This will disable agents, API access, and invitations while preserving data and billing access.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className={isSuspended ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
            <AlertTriangle className={`h-4 w-4 ${isSuspended ? 'text-green-600' : 'text-red-600'}`} />
            <AlertDescription className={isSuspended ? "text-green-800" : "text-red-800"}>
              <strong>Warning:</strong> This action will immediately {action} all services for this organization.
              {!isSuspended && " Users will receive a suspension notice and lose access to operational features."}
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="reason">Reason for {action}</Label>
            <Textarea
              id="reason"
              placeholder={`Explain why you are ${action}ing this organization...`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="confirmation">
              Type <code className="text-xs bg-muted px-1 py-0.5 rounded">{expectedPhrase}</code> to confirm
            </Label>
            <Input
              id="confirmation"
              value={confirmationPhrase}
              onChange={(e) => setConfirmationPhrase(e.target.value)}
              placeholder={expectedPhrase}
              className="mt-1 font-mono"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="notify-owner"
              checked={notifyOwner}
              onCheckedChange={(checked) => setNotifyOwner(checked as boolean)}
            />
            <Label htmlFor="notify-owner" className="text-sm">
              Notify organization owner by email
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isLoading || 
              !reason.trim() || 
              confirmationPhrase !== expectedPhrase
            }
            className={isSuspended ? 
              "bg-green-600 hover:bg-green-700" : 
              "bg-red-600 hover:bg-red-700"
            }
          >
            {isLoading ? `${action}ing...` : `${action} Organization`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}