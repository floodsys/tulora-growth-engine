import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.svg";
import saasAuth from "@/assets/saas-auth.svg";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  // Check if user is already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/dashboard');
      }
    };
    checkUser();
  }, [navigate]);

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

  const validateSignUpForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.fullName.trim()) {
      errors.fullName = "Full name is required";
    }
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
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate signup form if it's signup
    if (isSignUp && !validateSignUpForm()) {
      return;
    }
    
    setIsLoading(true);

    try {
      if (isSignUp) {
        // Split full name into first and last name
        const nameParts = formData.fullName.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: formData.fullName,
              first_name: firstName,
              last_name: lastName,
              organization_name: formData.organizationName,
              organization_size: formData.organizationSize,
              industry: formData.industry === "Other" ? formData.customIndustry : formData.industry,
            }
          }
        });

        if (error) throw error;

        // If user is immediately available (email confirmation disabled), upsert profile
        if (data.user) {
          try {
            const industry = formData.industry === "Other" ? formData.customIndustry : formData.industry;
            
            const { error: profileError } = await supabase
              .from('profiles')
              .upsert({
                user_id: data.user.id,
                full_name: formData.fullName,
                first_name: firstName,
                last_name: lastName,
                email: formData.email,
                organization_name: formData.organizationName,
                organization_size: formData.organizationSize,
                industry: industry,
              }, {
                onConflict: 'user_id'
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
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              navigate('/dashboard');
              return;
            }
          } catch (profileError) {
            console.error('Profile sync error:', profileError);
            toast({
              title: "Account created, but profile incomplete", 
              description: "Your account was created successfully, but we couldn't save your profile. Please update it in settings.",
              variant: "destructive",
            });
          }
        }

        toast({
          title: "Check your email",
          description: "We've sent you a confirmation link to complete your signup.",
        });
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
      toast({
        title: "Error",
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
          
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {isSignUp ? "Sign up" : "Sign in"}
          </h1>
          <p className="text-muted-foreground">
            {isSignUp ? "Start free" : "Welcome back!"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {isSignUp && (
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
                />
                {formErrors.fullName && (
                  <p className="text-xs text-destructive">{formErrors.fullName}</p>
                )}
              </div>

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
                />
                {formErrors.organizationName && (
                  <p className="text-xs text-destructive">{formErrors.organizationName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="organizationSize">Organization size *</Label>
                <Select onValueChange={(value) => handleSelectChange("organizationSize", value)}>
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
                <Select onValueChange={(value) => handleSelectChange("industry", value)}>
                  <SelectTrigger className={formErrors.industry ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Financial Services">Financial Services</SelectItem>
                    <SelectItem value="Education">Education</SelectItem>
                    <SelectItem value="Retail">Retail</SelectItem>
                    <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="Professional Services">Professional Services</SelectItem>
                    <SelectItem value="Real Estate">Real Estate</SelectItem>
                    <SelectItem value="Media & Entertainment">Media & Entertainment</SelectItem>
                    <SelectItem value="Non-profit">Non-profit</SelectItem>
                    <SelectItem value="Government">Government</SelectItem>
                    <SelectItem value="Agriculture">Agriculture</SelectItem>
                    <SelectItem value="Energy">Energy</SelectItem>
                    <SelectItem value="Transportation">Transportation</SelectItem>
                    <SelectItem value="Hospitality">Hospitality</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.industry && (
                  <p className="text-xs text-destructive">{formErrors.industry}</p>
                )}
              </div>

              {formData.industry === "Other" && (
                <div className="space-y-2">
                  <Label htmlFor="customIndustry">Please specify your industry *</Label>
                  <Input
                    id="customIndustry"
                    name="customIndustry"
                    type="text"
                    placeholder="Enter your industry"
                    value={formData.customIndustry}
                    onChange={handleInputChange}
                    className={formErrors.customIndustry ? "border-destructive" : ""}
                  />
                  {formErrors.customIndustry && (
                    <p className="text-xs text-destructive">{formErrors.customIndustry}</p>
                  )}
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={isSignUp ? "name@email.com" : "Enter your email..."}
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder={isSignUp ? "Password" : "Enter password..."}
              value={formData.password}
              onChange={handleInputChange}
              required
            />
          </div>

          {!isSignUp && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="stayLoggedIn"
                  checked={formData.stayLoggedIn}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, stayLoggedIn: checked as boolean }))
                  }
                />
                <Label htmlFor="stayLoggedIn" className="text-sm">Stay logged in</Label>
              </div>
              <Link 
                to="/forgot-password" 
                className="text-sm text-primary hover:underline"
              >
                Forgot Password?
              </Link>
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? "Loading..." : (isSignUp ? "Sign up" : "Sign in")}
          </Button>
        </form>

        {/* Toggle between Sign In/Sign Up */}
        <div className="mt-6 text-center">
          <p className="text-muted-foreground text-sm">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary hover:underline font-medium"
            >
              {isSignUp ? "Sign In" : "Get started for free"}
            </button>
          </p>
        </div>
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