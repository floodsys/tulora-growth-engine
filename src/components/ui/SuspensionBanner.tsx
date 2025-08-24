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
  isOwnerOrAdmin?: boolean;
}

export function SuspensionBanner({ 
  suspensionStatus, 
  suspensionReason, 
  suspendedAt,
  isOwnerOrAdmin = false 
}: SuspensionBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (suspensionStatus !== 'suspended') {
    return null;
  }

  return (
    <Alert className="border-red-200 bg-red-50 mb-6">
      <Ban className="h-4 w-4 text-red-600" />
      <AlertDescription className="text-red-800">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <strong>Organization Suspended</strong>
            <p className="mt-1">
              {isOwnerOrAdmin 
                ? "Your organization has been suspended. Agents, API access, and invites are disabled. You can still access billing and settings."
                : "This organization is suspended. Contact the organization owner or administrator for assistance."
              }
            </p>
            {isExpanded && suspensionReason && (
              <div className="mt-2 p-2 bg-red-100 rounded text-xs">
                <strong>Reason:</strong> {suspensionReason}
                {suspendedAt && (
                  <div className="mt-1">
                    <strong>Suspended:</strong> {new Date(suspendedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}
          </div>
          {(suspensionReason || suspendedAt) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-red-700 hover:text-red-800 ml-4"
            >
              {isExpanded ? 'Less' : 'Details'}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}