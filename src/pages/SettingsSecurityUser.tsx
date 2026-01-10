import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
    Shield,
    ShieldCheck,
    ShieldAlert,
    Trash2,
    Plus,
    QrCode,
    Key,
    CheckCircle,
    AlertTriangle,
    Loader2,
    RefreshCw,
    Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MFAFactor {
    id: string;
    factor_type: string;
    friendly_name?: string;
    status: string;
    created_at?: string;
}

interface AuthenticatorAssuranceLevel {
    currentLevel: 'aal1' | 'aal2' | null;
    nextLevel: 'aal1' | 'aal2' | null;
    currentAuthenticationMethods: Array<{
        method: string;
        timestamp: number;
    }>;
}

type EnrollmentStep = 'idle' | 'scan' | 'verify';

export default function SettingsSecurityUser() {
    const [factors, setFactors] = useState<MFAFactor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEnrolling, setIsEnrolling] = useState(false);
    const [enrollmentStep, setEnrollmentStep] = useState<EnrollmentStep>('idle');
    const [qrCode, setQrCode] = useState<string>('');
    const [secret, setSecret] = useState<string>('');
    const [factorId, setFactorId] = useState<string>('');
    const [challengeId, setChallengeId] = useState<string>('');
    const [verificationCode, setVerificationCode] = useState('');
    const [aalInfo, setAalInfo] = useState<AuthenticatorAssuranceLevel | null>(null);
    const [unenrollingFactorId, setUnenrollingFactorId] = useState<string | null>(null);
    const { toast } = useToast();

    const loadFactors = useCallback(async () => {
        try {
            const { data: factorData, error } = await supabase.auth.mfa.listFactors();
            if (error) throw error;

            // Combine TOTP and Phone factors
            const allFactors = [...(factorData.totp || []), ...(factorData.phone || [])];
            setFactors(allFactors);
        } catch (error: any) {
            toast({
                title: 'Error Loading Factors',
                description: error.message,
                variant: 'destructive'
            });
        }
    }, [toast]);

    const loadAALInfo = useCallback(async () => {
        try {
            const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            if (error) throw error;
            setAalInfo(data);
        } catch (error: any) {
            console.error('Error loading AAL info:', error);
        }
    }, []);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            await Promise.all([loadFactors(), loadAALInfo()]);
            setIsLoading(false);
        };
        loadData();
    }, [loadFactors, loadAALInfo]);

    const startEnrollment = async () => {
        setIsEnrolling(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('Please log in first to set up MFA');
            }

            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                friendlyName: 'Authenticator App'
            });

            if (error) {
                if (error.message?.includes('already exists') || error.message?.includes('conflict')) {
                    toast({
                        title: 'MFA Already Configured',
                        description: 'You already have a TOTP factor enrolled. Remove it first to enroll a new one.',
                        variant: 'default'
                    });
                    await loadFactors();
                    return;
                }
                throw error;
            }

            setQrCode(data.totp.qr_code);
            setSecret(data.totp.secret);
            setFactorId(data.id);
            setEnrollmentStep('scan');
        } catch (error: any) {
            toast({
                title: 'Enrollment Error',
                description: error.message || 'Failed to start MFA enrollment',
                variant: 'destructive'
            });
        } finally {
            setIsEnrolling(false);
        }
    };

    const createChallenge = async () => {
        if (!factorId) {
            toast({
                title: 'Missing Factor',
                description: 'No factor ID available. Please restart enrollment.',
                variant: 'destructive'
            });
            return;
        }

        setIsEnrolling(true);
        try {
            const { data: challenge, error } = await supabase.auth.mfa.challenge({
                factorId: factorId
            });

            if (error) throw error;

            setChallengeId(challenge.id);
            setEnrollmentStep('verify');
        } catch (error: any) {
            toast({
                title: 'Challenge Failed',
                description: error.message || 'Failed to create verification challenge',
                variant: 'destructive'
            });
        } finally {
            setIsEnrolling(false);
        }
    };

    const verifyEnrollment = async () => {
        const cleanCode = verificationCode.replace(/\s/g, '');
        if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
            toast({
                title: 'Invalid Code',
                description: 'Please enter a 6-digit verification code',
                variant: 'destructive'
            });
            return;
        }

        if (!factorId || !challengeId) {
            toast({
                title: 'Missing Data',
                description: 'Missing factor or challenge ID. Please restart enrollment.',
                variant: 'destructive'
            });
            resetEnrollment();
            return;
        }

        setIsEnrolling(true);
        try {
            const { error } = await supabase.auth.mfa.verify({
                factorId: factorId,
                challengeId: challengeId,
                code: cleanCode
            });

            if (error) {
                if (error.message?.includes('expired')) {
                    toast({
                        title: 'Challenge Expired',
                        description: 'The verification challenge has expired. Please try again.',
                        variant: 'destructive'
                    });
                    setEnrollmentStep('scan');
                    return;
                }
                throw error;
            }

            toast({
                title: 'MFA Enabled',
                description: 'Two-factor authentication has been successfully enabled for your account',
            });

            resetEnrollment();
            await loadFactors();
            await loadAALInfo();
        } catch (error: any) {
            toast({
                title: 'Verification Failed',
                description: error.message || 'Failed to verify code. Please check your authenticator app and try again.',
                variant: 'destructive'
            });
            setVerificationCode('');
        } finally {
            setIsEnrolling(false);
        }
    };

    const resetEnrollment = () => {
        setEnrollmentStep('idle');
        setQrCode('');
        setSecret('');
        setFactorId('');
        setChallengeId('');
        setVerificationCode('');
    };

    const unenrollFactor = async (factorIdToRemove: string) => {
        // Check if user is at aal2 level - required to unenroll
        if (aalInfo?.currentLevel !== 'aal2') {
            toast({
                title: 'Verification Required',
                description: 'You must verify your MFA code before removing a factor. Please log in again with MFA.',
                variant: 'destructive'
            });
            return;
        }

        setUnenrollingFactorId(factorIdToRemove);
        try {
            const { error } = await supabase.auth.mfa.unenroll({
                factorId: factorIdToRemove
            });

            if (error) {
                toast({
                    title: 'Unenroll Failed',
                    description: error.message,
                    variant: 'destructive'
                });
                return;
            }

            // Refresh session to downgrade AAL immediately
            await supabase.auth.refreshSession();

            toast({
                title: 'Factor Removed',
                description: 'MFA factor has been successfully removed from your account.',
            });

            await loadFactors();
            await loadAALInfo();
        } catch (error: any) {
            toast({
                title: 'Unenroll Error',
                description: error.message || 'Failed to remove factor',
                variant: 'destructive'
            });
        } finally {
            setUnenrollingFactorId(null);
        }
    };

    const refreshData = async () => {
        setIsLoading(true);
        await Promise.all([loadFactors(), loadAALInfo()]);
        setIsLoading(false);
    };

    const hasVerifiedFactors = factors.some(f => f.status === 'verified');
    const isAAL2 = aalInfo?.currentLevel === 'aal2';

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Shield className="h-6 w-6" />
                        Account Security
                    </h1>
                    <p className="text-muted-foreground">
                        Manage your multi-factor authentication settings
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={refreshData} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* MFA Status Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {hasVerifiedFactors ? (
                            <ShieldCheck className="h-5 w-5 text-green-600" />
                        ) : (
                            <ShieldAlert className="h-5 w-5 text-yellow-600" />
                        )}
                        MFA Status
                    </CardTitle>
                    <CardDescription>
                        Multi-factor authentication adds an extra layer of security to your account
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <div className="font-medium">Two-Factor Authentication</div>
                            <div className="text-sm text-muted-foreground">
                                {hasVerifiedFactors
                                    ? 'Your account is protected with MFA'
                                    : 'Enable MFA to add an extra layer of security'}
                            </div>
                        </div>
                        <Badge variant={hasVerifiedFactors ? 'default' : 'secondary'}>
                            {hasVerifiedFactors ? 'Enabled' : 'Disabled'}
                        </Badge>
                    </div>

                    {aalInfo && (
                        <div className="p-3 bg-muted rounded-lg text-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <Info className="h-4 w-4" />
                                <span className="font-medium">Current Session</span>
                            </div>
                            <div className="text-muted-foreground">
                                Authentication Level: <Badge variant="outline" className="ml-1">{aalInfo.currentLevel?.toUpperCase() || 'Unknown'}</Badge>
                                {isAAL2 && <span className="text-green-600 ml-2">✓ MFA verified this session</span>}
                            </div>
                        </div>
                    )}

                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>How MFA Works</AlertTitle>
                        <AlertDescription>
                            When MFA is enabled, you'll need to enter a code from your authenticator app each time you sign in.
                            This protects your account even if your password is compromised.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>

            {/* Enrolled Factors Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        Enrolled Factors
                    </CardTitle>
                    <CardDescription>
                        Manage your authentication factors
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {factors.length > 0 ? (
                        <div className="space-y-3">
                            {factors.map((factor) => (
                                <div key={factor.id} className="p-4 border rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-muted rounded-lg">
                                                <Shield className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <div className="font-medium">
                                                    {factor.friendly_name || factor.factor_type.toUpperCase()}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    Type: {factor.factor_type}
                                                </div>
                                            </div>
                                            <Badge variant={factor.status === 'verified' ? 'default' : 'secondary'}>
                                                {factor.status}
                                            </Badge>
                                        </div>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    disabled={unenrollingFactorId === factor.id || !isAAL2}
                                                    title={!isAAL2 ? 'You must verify MFA this session to remove factors' : undefined}
                                                >
                                                    {unenrollingFactorId === factor.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Remove
                                                        </>
                                                    )}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="flex items-center gap-2">
                                                        <AlertTriangle className="h-5 w-5 text-destructive" />
                                                        Remove MFA Factor
                                                    </AlertDialogTitle>
                                                    <AlertDialogDescription className="space-y-3">
                                                        <p>Are you sure you want to remove this authentication factor?</p>
                                                        <div className="p-3 bg-muted rounded-lg">
                                                            <strong>Factor:</strong> {factor.friendly_name || factor.factor_type}<br />
                                                            <strong>ID:</strong> <code className="text-xs">{factor.id}</code>
                                                        </div>
                                                        <p className="text-sm">
                                                            This will disable MFA for your account. You can re-enroll a new factor at any time.
                                                        </p>
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => unenrollFactor(factor.id)}
                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                    >
                                                        Remove Factor
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))}

                            {!isAAL2 && hasVerifiedFactors && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>MFA Verification Required</AlertTitle>
                                    <AlertDescription>
                                        To remove an MFA factor, you must first verify your MFA code this session.
                                        Please sign out and sign back in, then complete MFA verification.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    ) : (
                        <Alert>
                            <Shield className="h-4 w-4" />
                            <AlertDescription>
                                No MFA factors enrolled. Click the button below to set up two-factor authentication.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Enrollment Card */}
            {enrollmentStep === 'idle' && !hasVerifiedFactors && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5" />
                            Enroll New Factor
                        </CardTitle>
                        <CardDescription>
                            Set up an authenticator app to secure your account
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                            <p className="mb-2">You'll need an authenticator app such as:</p>
                            <ul className="list-disc pl-6 space-y-1">
                                <li>Google Authenticator</li>
                                <li>Authy</li>
                                <li>Microsoft Authenticator</li>
                                <li>1Password</li>
                            </ul>
                        </div>
                        <Button onClick={startEnrollment} disabled={isEnrolling}>
                            {isEnrolling ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Setting up...
                                </>
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Set Up Authenticator App
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* QR Code Scanning Step */}
            {enrollmentStep === 'scan' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <QrCode className="h-5 w-5" />
                            Scan QR Code
                        </CardTitle>
                        <CardDescription>
                            Use your authenticator app to scan this QR code
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col items-center space-y-4">
                            <div className="bg-white p-4 rounded-lg border">
                                <img
                                    src={qrCode}
                                    alt="QR code for authenticator app setup"
                                    className="max-w-[200px] h-auto"
                                />
                            </div>

                            <div className="w-full space-y-2">
                                <Label htmlFor="secret" className="text-sm font-medium">
                                    Manual Entry Key (if you can't scan):
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="secret"
                                        value={secret}
                                        readOnly
                                        className="font-mono text-xs pr-10"
                                    />
                                    <Key className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={createChallenge} disabled={isEnrolling} className="flex-1">
                                {isEnrolling ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    "I've Added It to My App"
                                )}
                            </Button>
                            <Button variant="outline" onClick={resetEnrollment}>
                                Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Verification Step */}
            {enrollmentStep === 'verify' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5" />
                            Verify Code
                        </CardTitle>
                        <CardDescription>
                            Enter the 6-digit code from your authenticator app
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-center">
                            <fieldset>
                                <legend className="sr-only">6-digit verification code</legend>
                                <InputOTP
                                    value={verificationCode}
                                    onChange={setVerificationCode}
                                    maxLength={6}
                                    autoFocus
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

                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                                Codes refresh every 30 seconds. If the code doesn't work, wait for the next one.
                            </AlertDescription>
                        </Alert>

                        <div className="flex gap-2">
                            <Button
                                onClick={verifyEnrollment}
                                disabled={isEnrolling || verificationCode.length !== 6}
                                className="flex-1"
                            >
                                {isEnrolling ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    'Verify & Enable MFA'
                                )}
                            </Button>
                            <Button variant="outline" onClick={() => setEnrollmentStep('scan')}>
                                Back
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
