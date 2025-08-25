import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MFAVerificationProps {
  onVerificationSuccess: () => void;
  onCancel: () => void;
}

export function MFAVerification({ onVerificationSuccess, onCancel }: MFAVerificationProps) {
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const verifyMFA = async () => {
    if (verificationCode.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter a 6-digit verification code',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      // Get user's MFA factors
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const totpFactor = factors.totp?.[0];
      if (!totpFactor) {
        throw new Error('No TOTP factor found');
      }

      // Create challenge
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id
      });
      if (challengeError) throw challengeError;

      // Verify code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code: verificationCode
      });
      if (verifyError) throw verifyError;

      // Set MFA verification timestamp in localStorage (expires in 12 hours)
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).getTime();
      localStorage.setItem('superadmin_mfa_verified', expiresAt.toString());

      // Log MFA verification
      await supabase.functions.invoke('auth-logger', {
        body: {
          action: 'mfa_verified',
          userId: (await supabase.auth.getUser()).data.user?.id,
          metadata: {
            factor_type: 'totp',
            superadmin: true,
            expires_at: expiresAt
          }
        }
      });

      toast({
        title: 'MFA Verified',
        description: 'You have been authenticated for the next 12 hours',
      });

      onVerificationSuccess();
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Failed to verify MFA code',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>MFA Verification Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Enter your 6-digit authentication code to access the admin dashboard. 
              This session will be valid for 12 hours.
            </AlertDescription>
          </Alert>
          
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the code from your authenticator app
            </p>
            
            <div className="flex justify-center">
              <InputOTP 
                value={verificationCode} 
                onChange={setVerificationCode}
                maxLength={6}
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
            
            <div className="flex space-x-2">
              <Button 
                onClick={verifyMFA} 
                disabled={isLoading || verificationCode.length !== 6}
                className="flex-1"
              >
                {isLoading ? 'Verifying...' : 'Verify'}
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}