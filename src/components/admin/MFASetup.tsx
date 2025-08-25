import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, QrCode, Key, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { mfaObservability } from '@/lib/mfa-observability';

interface MFASetupProps {
  onSetupComplete: () => void;
  onCancel: () => void;
}

export function MFASetup({ onSetupComplete, onCancel }: MFASetupProps) {
  const [step, setStep] = useState<'start' | 'scan' | 'verify'>('start');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [factorId, setFactorId] = useState<string>('');
  const [challengeId, setChallengeId] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const startMFASetup = async () => {
    setIsLoading(true);
    
    mfaObservability.addBreadcrumb({
      page: 'mfa_setup',
      action: 'start_enrollment',
      result: 'pending'
    });

    try {
      // Ensure we're running on the client with a valid session
      if (typeof window === 'undefined') {
        throw new Error('MFA setup must be completed on the client side');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please log in first to set up MFA');
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Superadmin TOTP'
      });

      if (error) {
        if (error.message?.includes('already exists') || error.message?.includes('conflict')) {
          mfaObservability.logMFAEvent({
            action: 'enroll',
            page: 'mfa_setup',
            success: false,
            error: new Error('Factor already exists'),
            metadata: { reason: 'duplicate_factor' }
          });

          toast({
            title: 'MFA Already Configured',
            description: 'TOTP factor already exists. You can proceed to verification.',
            variant: 'default'
          });
          onSetupComplete();
          return;
        }
        throw error;
      }

      mfaObservability.logMFAEvent({
        action: 'enroll',
        page: 'mfa_setup',
        factorId: data.id,
        success: true,
        metadata: { 
          factor_type: 'totp',
          friendly_name: 'Superadmin TOTP'
        }
      });

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id); // Store the factor ID
      setStep('scan');
    } catch (error: any) {
      mfaObservability.logMFAEvent({
        action: 'enroll',
        page: 'mfa_setup',
        success: false,
        error,
        metadata: { step: 'initial_setup' }
      });

      toast({
        title: 'MFA Setup Error',
        description: error.message || 'Failed to start MFA setup',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createChallenge = async () => {
    if (!factorId) {
      toast({
        title: 'Missing Factor ID',
        description: 'No factor ID available. Please restart MFA setup.',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: challenge, error } = await supabase.auth.mfa.challenge({
        factorId: factorId
      });

      if (error) throw error;
      
      setChallengeId(challenge.id);
      setStep('verify');
    } catch (error: any) {
      toast({
        title: 'Challenge Failed',
        description: error.message || 'Failed to create MFA challenge',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyAndComplete = async () => {
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
        description: 'Missing factor_id or challenge_id. Please restart MFA setup.',
        variant: 'destructive'
      });
      setStep('start');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: factorId,
        challengeId: challengeId,
        code: cleanCode
      });

      if (error) {
        if (error.message?.includes('expired') || error.message?.includes('invalid')) {
          toast({
            title: 'Challenge Expired',
            description: 'The verification challenge has expired. Please create a new challenge.',
            variant: 'destructive'
          });
          setStep('scan');
          return;
        }
        
        if (error.message?.includes('code')) {
          toast({
            title: 'Invalid Code',
            description: 'The verification code is incorrect. Please check your authenticator app.',
            variant: 'destructive'
          });
          setVerificationCode('');
          return;
        }
        
        throw error;
      }

      // Log MFA enrollment
      await supabase.functions.invoke('auth-logger', {
        body: {
          action: 'mfa_enrolled',
          userId: (await supabase.auth.getUser()).data.user?.id,
          metadata: {
            factor_type: 'totp',
            friendly_name: 'Superadmin TOTP',
            superadmin: true
          }
        }
      });

      toast({
        title: 'MFA Enabled',
        description: 'Two-factor authentication has been successfully enabled for your superadmin account',
      });

      onSetupComplete();
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
          <CardTitle>Superadmin MFA Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 'start' && (
            <>
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Multi-factor authentication is required for all superadmin accounts. 
                  This adds an extra layer of security to protect sensitive administrative functions.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  You'll need:
                  <ul className="list-disc pl-4 mt-2 space-y-1">
                    <li>An authenticator app (Google Authenticator, Authy, etc.)</li>
                    <li>Access to your mobile device</li>
                  </ul>
                </div>
                
                <div className="flex space-x-2">
                  <Button onClick={startMFASetup} disabled={isLoading} className="flex-1">
                    {isLoading ? 'Setting up...' : 'Start MFA Setup'}
                  </Button>
                  <Button variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === 'scan' && (
            <>
              <div className="text-center space-y-4">
                <QrCode className="w-8 h-8 mx-auto text-primary" />
                <h3 className="font-semibold">Scan QR Code or Enter Secret</h3>
                
                <div className="bg-white p-4 rounded-lg border" role="img" aria-label="QR code for TOTP setup">
                  <img 
                    src={qrCode} 
                    alt="QR code containing TOTP secret for authenticator app setup" 
                    className="mx-auto max-w-full h-auto"
                  />
                </div>
                
                <div className="text-left space-y-2">
                  <Label htmlFor="secret" className="text-sm font-medium">
                    Manual Entry Key (if you can't scan the QR code):
                  </Label>
                  <div className="relative">
                    <Input
                      id="secret"
                      value={secret}
                      readOnly
                      className="font-mono text-xs"
                      aria-label="TOTP secret key for manual entry into authenticator app"
                      title="Copy this key to manually add to your authenticator app"
                    />
                    <Key className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Open your authenticator app (Google Authenticator, Authy, etc.) and either:
                    <br />• Scan the QR code above, or
                    <br />• Add account manually using the key above
                  </p>
                </div>
                
                <Button 
                  onClick={() => createChallenge()} 
                  className="w-full"
                  aria-describedby="setup-help"
                >
                  I've Added It to My Authenticator App
                </Button>
                <div id="setup-help" className="text-xs text-muted-foreground">
                  Click this button after you've successfully added the account to your authenticator app
                </div>
              </div>
            </>
          )}

          {step === 'verify' && (
            <>
              <div className="text-center space-y-4">
                <CheckCircle className="w-8 h-8 mx-auto text-primary" />
                <h3 className="font-semibold">Enter Verification Code</h3>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code from your authenticator app to complete setup
                </p>
                
                <div className="flex justify-center">
                  <fieldset>
                    <legend className="sr-only">6-digit verification code</legend>
                    <InputOTP 
                      value={verificationCode} 
                      onChange={setVerificationCode}
                      maxLength={6}
                      autoFocus
                      aria-label="6-digit verification code from authenticator app"
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
                  </fieldset>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <div>💡 <strong>Hint:</strong> Codes refresh every 30 seconds</div>
                  <div>⏱️ If the code doesn't work, wait for the next one</div>
                </div>
                
                <div className="flex space-x-2">
                  <Button 
                    onClick={verifyAndComplete} 
                    disabled={isLoading || verificationCode.length !== 6}
                    className="flex-1"
                    aria-describedby="verify-help"
                  >
                    {isLoading ? 'Verifying...' : 'Verify & Complete Setup'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setStep('scan')}
                    aria-label="Go back to QR code step"
                  >
                    Back
                  </Button>
                </div>
                <div id="verify-help" className="text-xs text-muted-foreground">
                  This will complete your MFA setup and grant superadmin access
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}