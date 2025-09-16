import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { handleExtendedAuth } from "@/lib/extended-auth";
import { saveOrganization, type OrganizationData } from "@/lib/profile/saveOrganization";
import { OrganizationStep, type OrganizationStepValues } from "@/components/onboarding/OrganizationStep";
import { telemetry } from "@/lib/telemetry";
import { CheckCircle2 } from "lucide-react";
import logo from "@/assets/logo.svg";
import saasAuth from "@/assets/saas-auth.svg";

// Additive helper: prefer normalized correlationId → corr → traceId
const getCorrId = (err: any) =>
  err?.correlationId ?? err?.corr ?? err?.traceId ?? null;

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signupStep, setSignupStep] = useState(1); // 1 = Account, 2 = Organization
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  // Step 1 form data
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    stayLoggedIn: false,
  });
  
  // Step 2 organization data
  const [organizationData, setOrganizationData] = useState<OrganizationStepValues>({
    organizationName: "",
    organizationSize: "",
    industry: "",
  });
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check if user is already logged in and handle profile completion
  useEffect(() => {
    const checkUserAndProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if user has complete profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_name, organization_size, industry')
          .eq('user_id', session.user.id)
          .single();
        
        // If profile is missing required fields, go to complete profile
        if (!profile || !profile.organization_name || !profile.organization_size || !profile.industry) {
          navigate('/complete-profile');
        } else {
          navigate('/dashboard');
        }
      }
    };
    checkUserAndProfile();
  }, [navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.fullName.trim()) {
      errors.fullName = "Full name is required";
    }
    if (!formData.email.trim()) {
      errors.email = "Email address is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }
    if (!formData.password.trim()) {
      errors.password = "Password is required";
    } else if (formData.password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }
    
    setFormErrors(errors);
    
    // Focus first invalid field
    if (Object.keys(errors).length > 0) {
      const firstError = Object.keys(errors)[0];
      setTimeout(() => {
        const element = document.getElementById(firstError);
        if (element) element.focus();
      }, 100);
    }
    
    return Object.keys(errors).length === 0;
  };

  const handleContinueToStep2 = () => {
    if (validateStep1()) {
      telemetry.signupStepCompleted('account', 'email');
      setSignupStep(2);
    }
  };

  const handleBackToStep1 = () => {
    setSignupStep(1);
    setFormErrors({});
    setShowForgotPassword(false);
    setPasswordResetSent(false);
  };

  const handleOrganizationSubmit = async (values: OrganizationStepValues) => {
    setIsLoading(true);

    try {
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });

      if (error) {
        // Handle specific error types
        if (error.message.includes('already registered') || error.message.includes('already been registered')) {
          setFormErrors({ email: "An account with this email already exists." });
          setSignupStep(1); // Go back to step 1 to show the error
          return;
        }
        if (error.message.includes('password') && (error.message.includes('weak') || error.message.includes('short') || error.message.includes('6 characters'))) {
          setFormErrors({ password: "Password is too weak. Please choose a stronger password." });
          setSignupStep(1); // Go back to step 1 to show the error
          return;
        }
        throw error;
      }

      // If user is immediately available (email confirmation disabled), save profile
      if (data.user && data.session) {
        // Convert OrganizationStepValues to OrganizationData
        const finalIndustry = values.industry === "Other" ? values.customIndustry || "" : values.industry;
        const organizationData: OrganizationData = {
          organization_name: values.organizationName,
          organization_size: values.organizationSize,
          industry: finalIndustry,
        };

        const result = await saveOrganization({
          userId: data.user.id,
          fullName: formData.fullName,
          organizationData
        });

        if (!result.ok) {
          toast({
            title: "Account created, but profile incomplete",
            description: result.error || "We couldn't save your profile. Please update it in settings.",
            variant: "destructive",
          });
        } else {
          // Track successful signup completion
          telemetry.signupStepCompleted('organization', 'email');
        }

        // Navigate to dashboard if we have a session
        navigate('/dashboard');
        return;
      }

      // Email confirmation required - show success state
      telemetry.signupStepCompleted('organization', 'email');
      setShowEmailSent(true);
    } catch (error: any) {
      const corr = getCorrId(error);
      const baseDescription = error.message || "An unexpected error occurred. Please try again.";
      const description = corr ? `${baseDescription} (Corr ID: ${corr})` : baseDescription;
      
      console.error('Auth error', { corrId: corr, error });
      
      toast({
        title: "Couldn't create your account",
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await handleExtendedAuth(
        formData.email,
        formData.password,
        formData.stayLoggedIn
      );

      if (error) throw error;

      // Check if user is superadmin and needs MFA
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: isSuperadmin } = await supabase.rpc('is_superadmin');
        
        if (isSuperadmin) {
          // Log superadmin login for audit
          await supabase.functions.invoke('auth-logger', {
            body: {
              action: 'superadmin_login',
              userId: user.id,
              metadata: {
                email: user.email,
                timestamp: new Date().toISOString()
              }
            }
          });
        }
      }

      toast({
        title: "Welcome back!",
        description: "You've been signed in successfully.",
      });

      navigate('/dashboard');
    } catch (error: any) {
      const corr = getCorrId(error);
      const baseDescription = error.message || "Please check your credentials and try again.";
      const description = corr ? `${baseDescription} (Corr ID: ${corr})` : baseDescription;
      
      console.error('Auth error', { corrId: corr, error });
      
      toast({
        title: "Sign in failed",
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
      
      // Track Google auth initiation (completion will be tracked in callback/onboarding)
      telemetry.track('google_auth_initiated', { action: isSignUp ? 'signup' : 'signin' });
    } catch (error: any) {
      const corr = getCorrId(error);
      const baseDescription = error.message || "Failed to sign in with Google";
      const description = corr ? `${baseDescription} (Corr ID: ${corr})` : baseDescription;
      
      toast({
        title: "Error",
        description,
        variant: "destructive",
      });
      
      console.error('Auth error', { corrId: corr, error });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });

      if (error) throw error;

      toast({
        title: "Email sent",
        description: "We've sent you another verification link.",
      });
    } catch (error: any) {
      const corr = getCorrId(error);
      const baseDescription = "Failed to resend verification email. Please try again.";
      const description = corr ? `${baseDescription} (Corr ID: ${corr})` : baseDescription;
      
      console.error('Auth error', { corrId: corr, error });
      toast({
        title: "Error",
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      });

      if (error) throw error;

      setPasswordResetSent(true);
      toast({
        title: "Password reset email sent",
        description: "Check your email for a link to reset your password.",
      });
    } catch (error: any) {
      const corr = getCorrId(error);
      const baseDescription = error.message || "Failed to send password reset email.";
      const description = corr ? `${baseDescription} (Corr ID: ${corr})` : baseDescription;
      
      console.error('Auth error', { corrId: corr, error });
      toast({
        title: "Error",
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToSignIn = () => {
    setShowEmailSent(false);
    setIsSignUp(false);
    setSignupStep(1);
    setFormErrors({});
    setFormData({
      email: "",
      password: "",
      fullName: "",
      stayLoggedIn: false,
    });
    setOrganizationData({
      organizationName: "",
      organizationSize: "",
      industry: "",
    });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 max-w-md lg:max-w-lg mx-auto lg:mx-0">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="flex items-center mb-8">
            <img src={logo} alt="Tulora" className="h-8 w-auto" />
          </Link>
          
          <Link 
            to="/"
            className="text-muted-foreground hover:text-foreground transition-colors text-sm mb-6 inline-block"
          >
            ← Go to home
          </Link>
          
          {/* Email Sent Success State */}
          {showEmailSent ? (
            <>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Check your email
              </h1>
              <p className="text-muted-foreground">
                We sent a verification link to <strong>{formData.email}</strong> to activate your account.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {isSignUp ? "Sign up" : "Sign in"}
              </h1>
              <p className="text-muted-foreground">
                {isSignUp ? "Start free" : "Welcome back!"}
              </p>
            </>
          )}

          {/* Step indicator for signup */}
          {isSignUp && !showEmailSent && (
            <div className="mt-6 mb-6">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    signupStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {signupStep > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
                  </div>
                  <span className={`text-sm font-medium ${signupStep >= 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                    Account
                  </span>
                </div>
                <div className={`flex-1 h-px ${signupStep > 1 ? 'bg-primary' : 'bg-border'}`} />
                <div className="flex items-center space-x-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    signupStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    2
                  </div>
                  <span className={`text-sm font-medium ${signupStep >= 2 ? 'text-foreground' : 'text-muted-foreground'}`}>
                    Organization
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Email Sent Success State Content */}
        {showEmailSent ? (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-muted-foreground">
                Please check your email and click the verification link to activate your account.
              </p>
            </div>
            
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                size="lg"
                onClick={handleResendEmail}
                disabled={isLoading}
              >
                {isLoading ? "Sending..." : "Resend email"}
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                size="lg"
                onClick={handleBackToSignIn}
              >
                Back to Sign in
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* OAuth Buttons */}
            {!isSignUp && (
              <>
                <div className="space-y-3 mb-6">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    size="lg"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </Button>
                </div>

                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
                  </div>
                </div>
              </>
            )}

            {/* Step 1: Account Information */}
            {isSignUp && signupStep === 1 && (
              <form onSubmit={(e) => { e.preventDefault(); handleContinueToStep2(); }} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name *</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="First Last"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className={formErrors.fullName ? "border-destructive" : ""}
                    autoComplete="name"
                    disabled={isLoading}
                  />
                  {formErrors.fullName && (
                    <p className="text-xs text-destructive">{formErrors.fullName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email address *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@email.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={formErrors.email ? "border-destructive" : ""}
                    autoComplete="email"
                    disabled={isLoading}
                  />
                  {formErrors.email && (
                    <p className="text-xs text-destructive">{formErrors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <PasswordInput
                    id="password"
                    name="password"
                    placeholder="Password (minimum 8 characters)"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={formErrors.password ? "border-destructive" : ""}
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  {formErrors.password && (
                    <p className="text-xs text-destructive">{formErrors.password}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={isLoading || !formData.fullName.trim() || !formData.email.trim() || !formData.password.trim() || formData.password.length < 8}
                >
                  {isLoading ? "Please wait..." : "Continue"}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setIsSignUp(false)}
                      className="text-primary hover:underline font-medium"
                    >
                      Sign in
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* Step 2: Organization Information */}
            {isSignUp && signupStep === 2 && (
              <OrganizationStep
                initialValues={organizationData}
                onSubmit={handleOrganizationSubmit}
                onBack={handleBackToStep1}
                submitLabel="Create account"
                showBack={true}
              />
            )}

            {/* Sign In Form */}
            {!isSignUp && (
              <form onSubmit={handleSignIn} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@email.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={formErrors.email ? "border-destructive" : ""}
                   />
                   {formErrors.email && (
                     <p className="text-xs text-destructive">{formErrors.email}</p>
                   )}
                 </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={formErrors.password ? "border-destructive" : ""}
                  />
                  {formErrors.password && (
                    <p className="text-xs text-destructive">{formErrors.password}</p>
                  )}
                 </div>

                 <div className="flex items-center justify-between">
                   <div className="flex items-center space-x-2">
                     <Checkbox
                       id="stayLoggedIn"
                       checked={formData.stayLoggedIn}
                       onCheckedChange={(checked) => 
                         setFormData(prev => ({ ...prev, stayLoggedIn: !!checked }))
                       }
                     />
                     <Label htmlFor="stayLoggedIn" className="text-sm font-normal">
                       Keep me signed in for 30 days
                     </Label>
                   </div>
                   <button
                     type="button"
                     onClick={() => {
                       setShowForgotPassword(true);
                       setForgotPasswordEmail(formData.email);
                     }}
                     className="text-sm text-primary hover:underline"
                   >
                     Forgot your password?
                   </button>
                 </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Please wait..." : "Sign in"}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(true);
                        setSignupStep(1);
                        setFormErrors({});
                      }}
                      className="text-primary hover:underline font-medium"
                    >
                      Sign up
                    </button>
                  </p>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      {/* Right Panel - Image */}
      <div className="hidden lg:flex flex-1 bg-card">
        <img
          src={saasAuth}
          alt="SaaS authentication illustration"
          className="w-full h-full object-contain"
        />
      </div>

      {/* Forgot Password Modal */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          
          {!passwordResetSent ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgotEmail">Email address</Label>
                <Input
                  id="forgotEmail"
                  type="email"
                  placeholder="name@email.com"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !forgotPasswordEmail}
                  className="flex-1"
                >
                  {isLoading ? "Sending..." : "Send reset link"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-4">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-3" />
                <p className="text-sm text-muted-foreground">
                  We've sent a password reset link to <strong>{forgotPasswordEmail}</strong>
                </p>
              </div>
              
              <Button
                onClick={() => {
                  setShowForgotPassword(false);
                  setPasswordResetSent(false);
                  setForgotPasswordEmail("");
                }}
                className="w-full"
              >
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;