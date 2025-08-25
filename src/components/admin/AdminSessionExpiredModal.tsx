import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Clock, Shield, AlertTriangle } from 'lucide-react';

interface AdminSessionExpiredModalProps {
  isOpen: boolean;
  sessionAgeHours: number;
  maxAllowedHours: number;
  onForceReLogin: () => void;
}

export function AdminSessionExpiredModal({
  isOpen,
  sessionAgeHours,
  maxAllowedHours,
  onForceReLogin
}: AdminSessionExpiredModalProps) {
  const [timeRemaining, setTimeRemaining] = useState(30); // 30 seconds to re-login

  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          onForceReLogin();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, onForceReLogin]);

  useEffect(() => {
    if (isOpen) {
      setTimeRemaining(30);
    }
  }, [isOpen]);

  const formatTime = (seconds: number) => {
    return `${seconds}s`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Admin Session Expired
            <Badge variant="destructive" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {formatTime(timeRemaining)}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Your superadmin session has exceeded the maximum allowed duration and must be renewed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Policy:</strong> Superadmin sessions are limited to {maxAllowedHours} hours for enhanced security.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Session Age:</span>
              <Badge variant="outline">{sessionAgeHours.toFixed(1)} hours</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Maximum Allowed:</span>
              <Badge variant="outline">{maxAllowedHours} hours</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Action Required:</span>
              <Badge variant="destructive">Re-authentication</Badge>
            </div>
          </div>

          <div className="p-3 bg-muted rounded-lg text-sm">
            <p><strong>What happens next:</strong></p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>You will be signed out automatically</li>
              <li>Please sign in again to continue</li>
              <li>Your work and settings will be preserved</li>
              <li>This action is logged for security audit</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={onForceReLogin}
            variant="destructive"
            className="w-full"
          >
            Sign Out & Re-authenticate Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}