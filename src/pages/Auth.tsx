import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
    stayLoggedIn: false,
  });
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        // Sign up
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: formData.fullName,
            }
          }
        });

        if (error) throw error;

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
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="First Last"
                value={formData.fullName}
                onChange={handleInputChange}
                required
              />
              <p className="text-xs text-muted-foreground">Profile</p>
            </div>
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