import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { safeProfileUpsert, splitFullName } from "@/lib/profileUtils";
import { CheckCircle2 } from "lucide-react";
import logo from "@/assets/logo.svg";
import saasAuth from "@/assets/saas-auth.svg";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signupStep, setSignupStep] = useState(1); // 1 = Account, 2 = Organization
  const [showEmailSent, setShowEmailSent] = useState(false); // Success state for email confirmation
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    organizationName: "",
    organizationSize: "",
    industry: "",
    customIndustry: "",
    stayLoggedIn: false,
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

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter submits current step
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'BUTTON')) {
          e.preventDefault();
          const form = document.querySelector('form');
          if (form) {
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
            form.dispatchEvent(submitEvent);
          }
        }
      }
      
      // Esc closes toasts (handled by shadcn toast component automatically)
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user makes selection
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

  const validateStep2 = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.organizationName.trim()) {
      errors.organizationName = "Organization name is required";
    }
    if (!formData.organizationSize) {
      errors.organizationSize = "Organization size is required";
    }
    if (!formData.industry) {
      errors.industry = "Industry is required";
    }
    if (formData.industry === "Other" && !formData.customIndustry.trim()) {
      errors.customIndustry = "Please specify your industry";
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
      setSignupStep(2);
    }
  };

  const handleBackToStep1 = () => {
    setSignupStep(1);
    setFormErrors({});
  };

  const handleResendEmail = async () => {
    setIsLoading(true);
    try {
      const { firstName, lastName } = splitFullName(formData.fullName);
      const finalIndustry = formData.industry === "Other" ? formData.customIndustry : formData.industry;

      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: formData.fullName,
            first_name: firstName,
            last_name: lastName,
            organization_name: formData.organizationName,
            organization_size: formData.organizationSize,
            industry: finalIndustry,
          }
        }
      });

      if (error) throw error;

      toast({
        title: "Email sent",
        description: "We've sent you another verification link.",
      });
    } catch (error: any) {
      console.error('Resend email error:', error);
      toast({
        title: "Error",
        description: "Failed to resend verification email. Please try again.",
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
      organizationName: "",
      organizationSize: "",
      industry: "",
      customIndustry: "",
      stayLoggedIn: false,
    });
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth`
        }
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // For signup, validate current step
    if (isSignUp) {
      if (signupStep === 1) {
        handleContinueToStep2();
        return;
      } else if (signupStep === 2 && !validateStep2()) {
        return;
      }
    }
    
    setIsLoading(true);

    try {
      if (isSignUp) {
        // Split full name into first and last name
        const { firstName, lastName } = splitFullName(formData.fullName);
        
        // Get final industry value (use custom industry if "Other" was selected)
        const finalIndustry = formData.industry === "Other" ? formData.customIndustry : formData.industry;

        // Sign up with Supabase Auth
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              full_name: formData.fullName,
              first_name: firstName,
              last_name: lastName,
              organization_name: formData.organizationName,
              organization_size: formData.organizationSize,
              industry: finalIndustry,
            }
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

        // If user is immediately available (email confirmation disabled), upsert profile
        if (data.user && data.session) {
          try {
            // Use safe upsert that won't overwrite existing data
            const { error: profileError } = await safeProfileUpsert({
              user_id: data.user.id,
              full_name: formData.fullName,
              first_name: firstName,
              last_name: lastName,
              email: formData.email,
              organization_name: formData.organizationName,
              organization_size: formData.organizationSize,
              industry: finalIndustry,
            });

            if (profileError) {
              console.error('Profile upsert error:', profileError);
              toast({
                title: "Account created, but profile incomplete",
                description: "Your account was created successfully, but we couldn't save your profile. Please update it in settings.",
                variant: "destructive",
              });
            }

            // Navigate to dashboard if we have a session
            navigate('/dashboard');
            return;
          } catch (profileError) {
            console.error('Profile sync error:', profileError);
            toast({
              title: "Account created, but profile incomplete", 
              description: "Your account was created successfully, but we couldn't save your profile. Please update it in settings.",
              variant: "destructive",
            });
            navigate('/dashboard');
            return;
          }
        }

        // Email confirmation required - show success state
        setShowEmailSent(true);
      } else {
        // Sign in
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

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
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      
      // Generic error handling
      toast({
        title: "Couldn't create your account. Please try again.",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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

        {/* Form */}
        <form 
          onSubmit={handleSubmit} 
          className="space-y-6"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isLoading) {
              // Let the form handle submit naturally
            }
          }}
        >
          {/* Step 1: Account Information */}
          {isSignUp && signupStep === 1 && (
            <>
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
                <Input
                  id="password"
                  name="password"
                  type="password"
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
            </>
          )}

          {/* Step 2: Organization Information */}
          {isSignUp && signupStep === 2 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="organizationName">Organization name *</Label>
                <Input
                  id="organizationName"
                  name="organizationName"
                  type="text"
                  placeholder="Your company name"
                  value={formData.organizationName}
                  onChange={handleInputChange}
                  className={formErrors.organizationName ? "border-destructive" : ""}
                  autoComplete="organization"
                  disabled={isLoading}
                />
                {formErrors.organizationName && (
                  <p className="text-xs text-destructive">{formErrors.organizationName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="organizationSize">Organization size *</Label>
                <Select 
                  value={formData.organizationSize}
                  onValueChange={(value) => handleSelectChange("organizationSize", value)}
                  disabled={isLoading}
                >
                  <SelectTrigger className={formErrors.organizationSize ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select organization size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1–10">1–10</SelectItem>
                    <SelectItem value="11–50">11–50</SelectItem>
                    <SelectItem value="51–200">51–200</SelectItem>
                    <SelectItem value="201–500">201–500</SelectItem>
                    <SelectItem value="501–1,000">501–1,000</SelectItem>
                    <SelectItem value="1,001–5,000">1,001–5,000</SelectItem>
                    <SelectItem value="5,001+">5,001+</SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.organizationSize && (
                  <p className="text-xs text-destructive">{formErrors.organizationSize}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry *</Label>
                <Select 
                  value={formData.industry}
                  onValueChange={(value) => handleSelectChange("industry", value)}
                  disabled={isLoading}
                >
                  <SelectTrigger className={formErrors.industry ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Education">Education</SelectItem>
                    <SelectItem value="Retail">Retail</SelectItem>
                    <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="Real Estate">Real Estate</SelectItem>
                    <SelectItem value="Consulting">Consulting</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.industry && (
                  <p className="text-xs text-destructive">{formErrors.industry}</p>
                )}
              </div>

              {/* Conditional "Other" industry input */}
              {formData.industry === "Other" && (
                <div className="space-y-2">
                  <Label htmlFor="customIndustry">Specify industry *</Label>
                  <Input
                    id="customIndustry"
                    name="customIndustry"
                    type="text"
                    placeholder="Enter your industry"
                    value={formData.customIndustry}
                    onChange={handleInputChange}
                    className={formErrors.customIndustry ? "border-destructive" : ""}
                    disabled={isLoading}
                  />
                  {formErrors.customIndustry && (
                    <p className="text-xs text-destructive">{formErrors.customIndustry}</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Sign In Fields */}
          {!isSignUp && (
            <>
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
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={formErrors.password ? "border-destructive" : ""}
                />
                {formErrors.password && (
                  <p className="text-xs text-destructive">{formErrors.password}</p>
                )}
              </div>

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
            </>
          )}

          {/* Form Actions */}
          <div className="space-y-4">
            {isSignUp && signupStep === 2 ? (
              /* Step 2 buttons */
              <div className="flex flex-col space-y-3">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Creating account..." : "Create account"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={handleBackToStep1}
                  disabled={isLoading}
                >
                  Back
                </Button>
              </div>
            ) : (
              /* Step 1 or Sign In button */
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isLoading || (isSignUp && signupStep === 1 && (!formData.fullName.trim() || !formData.email.trim() || !formData.password.trim() || formData.password.length < 8))}
              >
                {isLoading ? "Please wait..." : (isSignUp ? "Continue" : "Sign in")}
              </Button>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          {isSignUp && signupStep === 1 && !showEmailSent && (
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
          )}
          {!isSignUp && !showEmailSent && (
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
          )}
        </div>
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
    </div>
  );
};

export default Auth;