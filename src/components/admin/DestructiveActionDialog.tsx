import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DestructiveActionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  actionName: string;
  targetType: string;
  targetId: string;
  confirmationText: string;
  dangerLevel: 'low' | 'medium' | 'high' | 'critical';
  onConfirm: (reason: string) => Promise<void>;
  affectedTables?: string[];
  estimatedTime?: string;
}

export function DestructiveActionDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  actionName,
  targetType,
  targetId,
  confirmationText,
  dangerLevel,
  onConfirm,
  affectedTables = [],
  estimatedTime
}: DestructiveActionDialogProps) {
  const { organization } = useUserOrganization();
  const { toast } = useToast();
  const [inputConfirmation, setInputConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [executing, setExecuting] = useState(false);

  const getDangerColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const handleConfirm = async () => {
    if (inputConfirmation !== confirmationText) {
      toast({
        title: 'Confirmation Error',
        description: 'The confirmation text does not match. Please type it exactly as shown.',
        variant: 'destructive'
      });
      return;
    }

    if (!reason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'You must provide a reason for this destructive action.',
        variant: 'destructive'
      });
      return;
    }

    setExecuting(true);
    try {
      // Use the secure RPC function for destructive actions
      const { data, error } = await supabase.rpc('admin_destructive_action', {
        p_action: actionName,
        p_target_type: targetType,
        p_target_id: targetId,
        p_reason: reason.trim(),
        p_confirmation: inputConfirmation,
        p_expected_confirmation: confirmationText,
        p_org_id: organization?.id,
        p_metadata: {
          danger_level: dangerLevel,
          affected_tables: affectedTables,
          estimated_time: estimatedTime
        }
      });

      if (error) throw error;

      const result = data as any;
      if (!result.success) {
        throw new Error(result.error || 'Action failed');
      }

      toast({
        title: 'Action Completed',
        description: `${actionName} has been executed successfully and logged.`,
      });

      // Call the parent's onConfirm with the reason
      await onConfirm(reason.trim());
      
      // Reset form and close dialog
      setInputConfirmation('');
      setReason('');
      onOpenChange(false);

    } catch (err) {
      console.error('Destructive action error:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to execute action',
        variant: 'destructive'
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleCancel = () => {
    setInputConfirmation('');
    setReason('');
    onOpenChange(false);
  };

  const isFormValid = inputConfirmation === confirmationText && reason.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Confirm Destructive Action
            <Badge className={getDangerColor(dangerLevel)}>
              {dangerLevel} risk
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {title}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This action cannot be undone and will be permanently logged in the audit trail.
              Ensure you have a database backup before proceeding.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h4 className="font-medium">Action Details:</h4>
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p><strong>Action:</strong> {actionName}</p>
              <p><strong>Target:</strong> {targetType} ({targetId})</p>
              {affectedTables.length > 0 && (
                <p><strong>Affected Tables:</strong> {affectedTables.join(', ')}</p>
              )}
              {estimatedTime && (
                <p><strong>Estimated Time:</strong> {estimatedTime}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm">{description}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Reason for this action (required):
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this action is necessary..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Type "{confirmationText}" to confirm:
              </label>
              <Input
                value={inputConfirmation}
                onChange={(e) => setInputConfirmation(e.target.value)}
                placeholder={confirmationText}
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This action will be logged with your user ID, timestamp, reason, and all metadata.
              Organization owners and auditors will be able to review this action.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={executing}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isFormValid || executing}
          >
            {executing ? 'Executing...' : `Execute ${actionName}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}