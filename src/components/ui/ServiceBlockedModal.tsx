import { AlertTriangle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ServiceBlockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationStatus: 'suspended' | 'canceled';
  isOwnerOrAdmin: boolean;
}

export function ServiceBlockedModal({ 
  isOpen, 
  onClose, 
  organizationStatus,
  isOwnerOrAdmin 
}: ServiceBlockedModalProps) {
  const isCanceled = organizationStatus === 'canceled';
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${isCanceled ? 'text-destructive' : 'text-warning'}`} />
            Service {isCanceled ? 'Canceled' : 'Suspended'}
          </DialogTitle>
          <DialogDescription>
            This organization's service has been {organizationStatus}.
          </DialogDescription>
        </DialogHeader>

        <Alert className={`${isCanceled ? 'border-destructive bg-destructive/10' : 'border-warning bg-warning/10'}`}>
          <AlertTriangle className={`h-4 w-4 ${isCanceled ? 'text-destructive' : 'text-warning'}`} />
          <AlertDescription className={`${isCanceled ? 'text-destructive' : 'text-warning'}`}>
            {isCanceled ? (
              <>All services are currently disabled due to account cancellation.</>
            ) : (
              <>Agents, API access, and new invites are currently disabled. You can still access billing and settings.</>
            )}
          </AlertDescription>
        </Alert>

        <div className="text-sm text-muted-foreground">
          {isOwnerOrAdmin ? (
            isCanceled ? (
              "As the organization owner/admin, please contact support to discuss reactivation options."
            ) : (
              "As the organization owner/admin, please review your billing settings or contact support to resolve any issues."
            )
          ) : (
            "Please contact your organization owner or administrator for assistance."
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full">
            Close
          </Button>
          {isOwnerOrAdmin && (
            <Button className="w-full" asChild>
              <a href="mailto:support@example.com" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Contact Support
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}