import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMFAAttemptThrottling } from '@/hooks/useMFAAttemptThrottling';

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
  const [lastError, setLastError] = useState<any>(null);
  const { toast } = useToast();
  const throttling = useMFAAttemptThrottling(5, 2000);

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
    // Check throttling first
    if (!throttling.canAttempt) {
      const waitTime = Math.ceil(throttling.cooldownTime / 1000);
      toast({
        title: 'Too Many Attempts',
        description: `Please wait ${waitTime} seconds before trying again. Attempts left: ${throttling.attemptsLeft}`,
        variant: 'destructive'
      });
      return;
    }

    // Strip spaces and validate code
    const cleanCode = verificationCode.replace(/\s/g, '');
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      toast({
        title: 'Invalid Code Format',
        description: 'Please enter a 6-digit verification code',
        variant: 'destructive'
      });
      return;
    }

    // Check for required UUIDs
    if (!factorId || !challengeId) {
      toast({
        title: 'Missing Challenge',
        description: 'Missing factor_id or challenge_id. Creating new challenge...',
        variant: 'destructive'
      });
      initializeMFA();
      return;
    }

    setIsLoading(true);
    setLastError(null);
    
    try {
      // Verify code with proper UUIDs
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factorId,
        challengeId: challengeId,
        code: cleanCode
      });
      
      if (verifyError) {
        // Store structured error for debugging
        const structuredError = {
          ok: false,
          error: verifyError.message || 'Verification failed',
          hint: getErrorHint(verifyError),
          cause: verifyError.name || 'MFAError',
          timestamp: new Date().toISOString()
        };
        setLastError(structuredError);

        // Handle specific error cases with clear messaging
        if (verifyError.message?.includes('expired') || verifyError.message?.includes('invalid_challenge')) {
          toast({
            title: 'Challenge Expired',
            description: 'Your verification challenge has expired. Creating a new one...',
            variant: 'destructive'
          });
          initializeMFA();
          return;
        }
        
        if (verifyError.message?.includes('code') || verifyError.message?.includes('invalid_totp')) {
          // Record failed attempt for throttling
          throttling.recordFailedAttempt();
          
          toast({
            title: 'Incorrect Verification Code',
            description: `The code is incorrect. ${throttling.attemptsLeft - 1} attempts remaining.`,
            variant: 'destructive'
          });
          setVerificationCode('');
          return;
        }

        if (verifyError.message?.includes('rate_limit') || verifyError.message?.includes('too_many_requests')) {
          toast({
            title: 'Rate Limited',
            description: 'Too many verification attempts. Please wait before trying again.',
            variant: 'destructive'
          });
          return;
        }
        
        // Generic error
        toast({
          title: 'Verification Failed',
          description: structuredError.error,
          variant: 'destructive'
        });
        return;
      }

      // Success - reset throttling
      throttling.reset();

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
            expires_at: expiresAt,
            attempts_before_success: 5 - throttling.attemptsLeft
          }
        }
      });

      // Refresh session to ensure it's updated
      await supabase.auth.refreshSession();

      toast({
        title: 'MFA Verified Successfully',
        description: 'You have been authenticated for the next 12 hours',
      });

      // Navigate to admin dashboard
      navigate('/admin');
      onVerificationSuccess();
    } catch (error: any) {
      const structuredError = {
        ok: false,
        error: error.message || 'Unknown verification error',
        hint: 'Check your network connection and try again',
        cause: error.name || 'NetworkError',
        timestamp: new Date().toISOString()
      };
      setLastError(structuredError);
      
      toast({
        title: 'Verification Error',
        description: structuredError.error,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getErrorHint = (error: any): string => {
    if (error.message?.includes('expired')) return 'Try creating a new challenge';
    if (error.message?.includes('code')) return 'Check your authenticator app for the current code';
    if (error.message?.includes('rate_limit')) return 'Wait a few minutes before trying again';
    if (error.message?.includes('network')) return 'Check your internet connection';
    return 'Try refreshing the page or contact support';
  };

  const createNewChallenge = async () => {
    setLastError(null);
    await initializeMFA();
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

          {/* Throttling Warning */}
          {!throttling.canAttempt && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Too many failed attempts. Please wait {Math.ceil(throttling.cooldownTime / 1000)} seconds before trying again.
                {throttling.attemptsLeft > 0 && ` (${throttling.attemptsLeft} attempts remaining)`}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {lastError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div><strong>Error:</strong> {lastError.error}</div>
                  <div><strong>Hint:</strong> {lastError.hint}</div>
                  <details className="text-xs">
                    <summary className="cursor-pointer">Debug Info</summary>
                    <pre className="mt-1 text-xs overflow-auto">
                      {JSON.stringify(lastError, null, 2)}
                    </pre>
                  </details>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the code from your authenticator app
            </p>
            
            <div className="flex justify-center">
              <InputOTP 
                value={verificationCode} 
                onChange={setVerificationCode}
                maxLength={6}
                disabled={!throttling.canAttempt || isLoading}
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
                disabled={isLoading || verificationCode.length !== 6 || !throttling.canAttempt}
                className="flex-1"
              >
                {isLoading ? 'Verifying...' : 'Verify'}
              </Button>
              <Button 
                variant="outline" 
                onClick={createNewChallenge}
                disabled={isLoading}
                title="Create new challenge if current one expired"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>

            {/* Challenge status */}
            {challengeId && (
              <div className="text-xs text-muted-foreground">
                Challenge ID: <code className="bg-muted px-1 rounded">{challengeId.slice(0, 8)}...</code>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}