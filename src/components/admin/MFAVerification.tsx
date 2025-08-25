import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [verificationCode, setVerificationCode] = useState('');
  const [factorId, setFactorId] = useState<string>('');
  const [challengeId, setChallengeId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    initializeMFA();
  }, []);

  const initializeMFA = async () => {
    try {
      // Ensure we're running on the client with a valid session
      if (typeof window === 'undefined') {
        console.warn('MFA initialization attempted on server-side');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'No Session',
          description: 'Please log in first to set up MFA',
          variant: 'destructive'
        });
        onCancel();
        return;
      }

      // Get user's MFA factors
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        toast({
          title: 'MFA Access Error',
          description: `Failed to check MFA factors: ${factorsError.message}`,
          variant: 'destructive'
        });
        return;
      }

      const totpFactor = factors.totp?.[0];
      if (!totpFactor) {
        toast({
          title: 'No MFA Factor Found',
          description: 'No TOTP factor found. Please set up MFA first before accessing admin features.',
          variant: 'destructive'
        });
        onCancel();
        return;
      }

      setFactorId(totpFactor.id);

      // Create initial challenge
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id
      });
      
      if (challengeError) {
        toast({
          title: 'Challenge Creation Failed',
          description: `Failed to create MFA challenge: ${challengeError.message}`,
          variant: 'destructive'
        });
        return;
      }

      setChallengeId(challenge.id);
    } catch (error: any) {
      toast({
        title: 'MFA Initialization Failed',
        description: error.message || 'Failed to initialize MFA verification',
        variant: 'destructive'
      });
    }
  };

  const verifyMFA = async () => {
    // Strip spaces and validate code
    const cleanCode = verificationCode.replace(/\s/g, '');
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter a 6-digit verification code',
        variant: 'destructive'
      });
      return;
    }

    // Check for required UUIDs
    if (!factorId || !challengeId) {
      toast({
        title: 'Missing UUIDs',
        description: 'Missing factor_id or challenge_id. Please refresh the page and try again.',
        variant: 'destructive'
      });
      // Try to reinitialize
      initializeMFA();
      return;
    }

    setIsLoading(true);
    try {
      // Verify code with proper UUIDs
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factorId,
        challengeId: challengeId,
        code: cleanCode
      });
      
      if (verifyError) {
        // Handle specific error cases
        if (verifyError.message?.includes('expired') || verifyError.message?.includes('invalid')) {
          toast({
            title: 'Challenge Expired or Invalid',
            description: 'The verification challenge has expired. Creating a new challenge...',
            variant: 'destructive'
          });
          // Create new challenge and retry
          initializeMFA();
          return;
        }
        
        if (verifyError.message?.includes('code')) {
          toast({
            title: 'Invalid Code',
            description: 'The verification code is incorrect. Please check your authenticator app and try again.',
            variant: 'destructive'
          });
          setVerificationCode('');
          return;
        }
        
        throw verifyError;
      }

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

      // Refresh session to ensure it's updated
      await supabase.auth.refreshSession();

      toast({
        title: 'MFA Verified',
        description: 'You have been authenticated for the next 12 hours',
      });

      // Navigate to admin dashboard
      navigate('/admin');
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