import { useState } from 'react';
import { AlertTriangle, Ban, Play } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrganization } from '@/hooks/useUserOrganization';

interface SuspensionBannerProps {
  suspensionStatus?: string;
  suspensionReason?: string;
  suspendedAt?: string;
  canceledAt?: string;
  isOwnerOrAdmin?: boolean;
}

export function SuspensionBanner({ 
  suspensionStatus, 
  suspensionReason, 
  suspendedAt,
  canceledAt,
  isOwnerOrAdmin = false 
}: SuspensionBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!suspensionStatus || suspensionStatus === 'active') {
    return null;
  }

  const isSuspended = suspensionStatus === 'suspended';
  const isCanceled = suspensionStatus === 'canceled';

  return (
    <Alert className={`mb-6 ${isCanceled ? 'border-destructive bg-destructive/10' : 'border-warning bg-warning/10'}`}>
      <Ban className={`h-4 w-4 ${isCanceled ? 'text-destructive' : 'text-warning'}`} />
      <AlertDescription className={isCanceled ? 'text-destructive' : 'text-warning'}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <strong>Organization {isCanceled ? 'Canceled' : 'Suspended'}</strong>
            <p className="mt-1">
              {isCanceled ? (
                isOwnerOrAdmin 
                  ? "Your organization has been canceled. All services are disabled. Contact support to discuss reactivation."
                  : "This organization has been canceled. Contact the organization owner or support for assistance."
              ) : (
                isOwnerOrAdmin 
                  ? "Your organization has been suspended. Agents, API access, and invites are disabled. You can still access billing and settings."
                  : "This organization is suspended. Contact the organization owner or administrator for assistance."
              )}
            </p>
            {isExpanded && suspensionReason && (
              <div className={`mt-2 p-2 rounded text-xs ${isCanceled ? 'bg-destructive/20' : 'bg-warning/20'}`}>
                <strong>Reason:</strong> {suspensionReason}
                {(suspendedAt || canceledAt) && (
                  <div className="mt-1">
                    <strong>{isCanceled ? 'Canceled' : 'Suspended'}:</strong> {' '}
                    {new Date(isCanceled ? canceledAt! : suspendedAt!).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}
          </div>
          {(suspensionReason || suspendedAt || canceledAt) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`ml-4 hover:opacity-80 ${isCanceled ? 'text-destructive hover:text-destructive' : 'text-warning hover:text-warning'}`}
            >
              {isExpanded ? 'Less' : 'Details'}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}