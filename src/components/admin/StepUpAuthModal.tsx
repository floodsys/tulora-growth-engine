import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Shield, Clock, Smartphone, Key } from 'lucide-react';
import { useStepUpAuth } from '@/hooks/useStepUpAuth';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

interface StepUpAuthModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  actionName: string;
  actionDescription: string;
}

export function StepUpAuthModal({
  isOpen,
  onOpenChange,
  onSuccess,
  actionName,
  actionDescription
}: StepUpAuthModalProps) {
  const [activeTab, setActiveTab] = useState<'mfa' | 'password'>('mfa');
  const [mfaCode, setMfaCode] = useState('');
  const [password, setPassword] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes
  
  const { isLoading, verifyMFA, verifyPassword, hasValidSession } = useStepUpAuth();

  // Update countdown timer
  useEffect(() => {
    if (!isOpen) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          onOpenChange(false);
          return 300;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, onOpenChange]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setMfaCode('');
      setPassword('');
      setTimeRemaining(300);
    }
  }, [isOpen]);

  // Close modal and trigger success when session is valid
  useEffect(() => {
    if (hasValidSession && isOpen) {
      onOpenChange(false);
      onSuccess();
    }
  }, [hasValidSession, isOpen, onOpenChange, onSuccess]);

  const handleMFASubmit = async () => {
    if (mfaCode.length === 6) {
      await verifyMFA(mfaCode);
    }
  };

  const handlePasswordSubmit = async () => {
    if (password.trim()) {
      await verifyPassword(password);
    }
  };

  const handleCancel = () => {
    setMfaCode('');
    setPassword('');
    onOpenChange(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-destructive" />
            Step-up Authentication Required
            <Badge variant="destructive" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {formatTime(timeRemaining)}
            </Badge>
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              <strong>{actionName}</strong> requires additional authentication for security.
            </p>
            <p className="text-sm text-muted-foreground">
              {actionDescription}
            </p>
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Choose your preferred authentication method. This verification is valid for 5 minutes.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'mfa' | 'password')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="mfa" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              MFA Code
            </TabsTrigger>
            <TabsTrigger value="password" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Password
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mfa" className="space-y-4">
            <div className="space-y-2">
              <Label>Enter 6-digit code from your authenticator app:</Label>
              <div className="flex justify-center">
                <InputOTP
                  value={mfaCode}
                  onChange={setMfaCode}
                  maxLength={6}
                  disabled={isLoading}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="password" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Re-enter your password:</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && password.trim()) {
                    handlePasswordSubmit();
                  }
                }}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={activeTab === 'mfa' ? handleMFASubmit : handlePasswordSubmit}
            disabled={
              isLoading ||
              (activeTab === 'mfa' && mfaCode.length !== 6) ||
              (activeTab === 'password' && !password.trim())
            }
          >
            {isLoading ? 'Verifying...' : 'Verify & Continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}