import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Shield, Key, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MFAFactor {
  id: string;
  factor_type: string;
  friendly_name?: string;
  status: string;
}

interface MFAChallenge {
  id: string;
  type: string;
  expires_at: number;
}

export default function AdminMFADiag() {
  const { hasAccess, isChecking, AccessDeniedComponent } = useAdminAccess();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [user, setUser] = useState<any>(null);
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [selectedFactorId, setSelectedFactorId] = useState<string>('');
  const [currentChallenge, setCurrentChallenge] = useState<MFAChallenge | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  useEffect(() => {
    if (hasAccess) {
      loadMFAInfo();
    }
  }, [hasAccess]);

  const loadMFAInfo = async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      setUser(user);

      // Get MFA factors
      const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();
      if (factorError) throw factorError;
      
      setFactors(factorData.totp || []);
      
      // Auto-select first factor if available
      if (factorData.totp?.length > 0) {
        setSelectedFactorId(factorData.totp[0].id);
      }
    } catch (error: any) {
      toast({
        title: 'Error Loading MFA Info',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const createChallenge = async () => {
    if (!selectedFactorId) {
      toast({
        title: 'No Factor Selected',
        description: 'Please select an MFA factor first',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: challenge, error } = await supabase.auth.mfa.challenge({
        factorId: selectedFactorId
      });
      
      if (error) throw error;
      
      setCurrentChallenge(challenge);
      setVerificationResult(null);
      
      toast({
        title: 'Challenge Created',
        description: `Challenge ID: ${challenge.id}`,
      });
    } catch (error: any) {
      toast({
        title: 'Challenge Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!selectedFactorId || !currentChallenge || verificationCode.length !== 6) {
      toast({
        title: 'Invalid Input',
        description: 'Please ensure you have a challenge and enter a 6-digit code',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.verify({
        factorId: selectedFactorId,
        challengeId: currentChallenge.id,
        code: verificationCode
      });
      
      setVerificationResult({
        success: !error,
        data: data,
        error: error?.message || null,
        timestamp: new Date().toISOString()
      });

      if (error) {
        toast({
          title: 'Verification Failed',
          description: error.message,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Verification Successful',
          description: 'MFA code verified successfully!',
        });
      }
    } catch (error: any) {
      setVerificationResult({
        success: false,
        data: null,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      toast({
        title: 'Verification Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking access
  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Verifying MFA diagnostic access...</p>
        </div>
      </div>
    );
  }

  // Block access for non-superadmins
  if (!hasAccess) {
    return <AccessDeniedComponent />;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
            <div>
              <h1 className="text-2xl font-bold">MFA Diagnostics</h1>
              <p className="text-sm text-muted-foreground">
                Diagnose MFA issues for superadmin access
              </p>
            </div>
          </div>
          <Button onClick={loadMFAInfo} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Session User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Session User</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="space-y-2">
                <div><strong>ID:</strong> <code className="bg-muted px-2 py-1 rounded text-sm">{user.id}</code></div>
                <div><strong>Email:</strong> {user.email}</div>
                <div><strong>Confirmed:</strong> <Badge variant={user.email_confirmed_at ? "default" : "destructive"}>{user.email_confirmed_at ? "Yes" : "No"}</Badge></div>
                <div><strong>MFA Enabled:</strong> <Badge variant={factors.length > 0 ? "default" : "secondary"}>{factors.length > 0 ? "Yes" : "No"}</Badge></div>
              </div>
            ) : (
              <p className="text-muted-foreground">No user session found</p>
            )}
          </CardContent>
        </Card>

        {/* MFA Factors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="h-5 w-5" />
              <span>MFA Factors</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {factors.length > 0 ? (
              <div className="space-y-3">
                {factors.map((factor) => (
                  <div key={factor.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id={factor.id}
                          name="factor"
                          value={factor.id}
                          checked={selectedFactorId === factor.id}
                          onChange={(e) => setSelectedFactorId(e.target.value)}
                          className="w-4 h-4"
                        />
                        <label htmlFor={factor.id} className="font-medium cursor-pointer">
                          {factor.friendly_name || factor.factor_type}
                        </label>
                      </div>
                      <Badge variant={factor.status === 'verified' ? "default" : "secondary"}>
                        {factor.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div><strong>ID:</strong> <code className="bg-muted px-1 rounded text-xs">{factor.id}</code></div>
                      <div><strong>Type:</strong> {factor.factor_type}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  No MFA factors found. You may need to set up MFA first.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Challenge & Verification */}
        {factors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Challenge & Verify</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Button 
                  onClick={createChallenge} 
                  disabled={isLoading || !selectedFactorId}
                  variant="outline"
                >
                  {isLoading ? 'Creating...' : 'Create Challenge'}
                </Button>
              </div>

              {currentChallenge && (
                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Current Challenge</h4>
                  <div className="text-sm space-y-1">
                    <div><strong>Challenge ID:</strong> <code className="bg-background px-1 rounded text-xs">{currentChallenge.id}</code></div>
                    <div><strong>Type:</strong> {currentChallenge.type}</div>
                    <div><strong>Expires:</strong> {new Date(currentChallenge.expires_at * 1000).toLocaleString()}</div>
                  </div>
                </div>
              )}

              {currentChallenge && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Enter Verification Code
                    </label>
                    <div className="flex justify-start">
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
                  </div>
                  
                  <Button 
                    onClick={verifyCode} 
                    disabled={isLoading || verificationCode.length !== 6}
                  >
                    {isLoading ? 'Verifying...' : 'Verify Code'}
                  </Button>
                </div>
              )}

              {verificationResult && (
                <div className="p-3 border rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center space-x-2">
                    <span>Verification Result</span>
                    <Badge variant={verificationResult.success ? "default" : "destructive"}>
                      {verificationResult.success ? "Success" : "Failed"}
                    </Badge>
                  </h4>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(verificationResult, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}