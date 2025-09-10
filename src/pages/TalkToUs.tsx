import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buildContactPayload, validateContactPayload } from "@/lib/contact-payload";
import { CONTACT_SALES_FN } from "@/lib/constants";
import { ApiErrorPanel } from "@/components/ui/ApiErrorPanel";
import contactUsImage from "@/assets/contact-us.svg";
import talkToUsGraphic from "@/assets/talk-to-us-graphic.png";
import logoSvg from "@/assets/logo.svg";
import { SUPABASE_URL, SUPABASE_ANON } from "@/config/publicConfig";
import { useContactFormSecurity } from "@/hooks/useContactFormSecurity";
// import { useTurnstile } from "@/hooks/useTurnstile";


const TalkToUs = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<any>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    company: "",
    project: "",
    // Honeypot field - should remain empty
    website: ""
  });

  // Disable Turnstile for testing
  // const { token: turnstileToken, isReady: turnstileReady } = useTurnstile('turnstile-widget', { theme: 'light' });
  const turnstileToken = "test-token"; // Mock token for testing
  const turnstileReady = true;

  // Apply security headers for contact forms
  useContactFormSecurity();

  // Verify runtime Supabase config
  useEffect(() => {
    // Log Supabase config verification
    console.log('=== SUPABASE CONFIG VERIFICATION ===');
    console.log('publicConfig.SUPABASE_URL:', SUPABASE_URL);
    console.log('publicConfig.SUPABASE_ANON_KEY (masked):', SUPABASE_ANON ? `${SUPABASE_ANON.substring(0, 20)}...` : 'MISSING');
    console.log('supabase.functions.url:', SUPABASE_URL + '/functions/v1');
    
    // Additional SW check for debugging
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        console.log('[TalkToUs] Current SW scopes after cleanup:', registrations.map(r => r.scope));
        if (registrations.length > 0) {
          console.warn('[TalkToUs] SWs still active! This may cause form submission failures.');
        }
      });
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'phone') {
      // Only allow numbers for phone field
      const numbersOnly = value.replace(/\D/g, '');
      setFormData(prev => ({
        ...prev,
        [name]: numbersOnly
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('CONTACT_SUBMIT start');
    
    // Honeypot neutralized for preview - let server handle rejection

    // Turnstile disabled for testing
    // if (!turnstileToken) {
    //   toast({
    //     title: "Please complete verification",
    //     description: "Please complete the security check to continue",
    //     variant: "destructive"
    //   });
    //   return;
    // }
    
    // Basic validation - required fields including phone and company
    if (!formData.fullName || !formData.email || !formData.phone || !formData.company || !formData.project) {
      toast({
        title: "Please fill in all required fields",
        description: "Full name, email, phone number, company, and project description are required",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      setSubmitError(null);
      const { data: { session } } = await supabase.auth.getSession();
      
      // Build canonical payload - only allowed snake_case keys
      const payload = buildContactPayload('contact', {
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        company: formData.company,
        project: formData.project, // maps to message
        website: formData.website // honeypot
      });
      
      console.log('Built payload keys:', Object.keys(payload));
      
      // Validate payload
      const validationErrors = validateContactPayload(payload);
      if (validationErrors.length > 0) {
        setSubmitError({
          status: 422,
          details: validationErrors,
          message: 'Please fix the following errors:'
        });
        return;
      }

      console.log('invoke called');
      
      const { data, error } = await supabase.functions.invoke(CONTACT_SALES_FN, {
        body: payload,
        headers: {
          'Cache-Control': 'no-store',
          ...(session?.access_token ? {
            Authorization: `Bearer ${session.access_token}`
          } : {})
        }
      });

      console.log('🔍 Invoke response:', { data, error });

      if (error) {
        setSubmitError(error);
        return;
      }

      if (data?.success) {
        setIsSubmitted(true);
        setSubmitError(null);
        // Reset form
        setFormData({
          fullName: "",
          email: "",
          phone: "",
          company: "",
          project: "",
          website: ""
        });
        // Form reset handled by hook
      } else {
        setSubmitError({
          message: data?.error || 'Failed to submit form',
          details: data?.details
        });
      }
    } catch (error: any) {
      console.error('Full error object:', {
        name: error?.name || 'No name',
        message: error?.message || 'No message',
        'error.response.status': error?.response?.status || 'No response.status',
        'error.response.text (first 200 chars)': error?.response?.text ? 
          (typeof error.response.text === 'string' ? error.response.text.substring(0, 200) : 
           typeof error.response.text === 'function' ? '[function]' : String(error.response.text).substring(0, 200)) 
          : 'No response.text',
        fullError: error
      });
      setSubmitError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="py-6 px-4 sm:px-6 lg:px-8 border-b border-border/20">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <Link to="/">
              <img src={logoSvg} alt="Tulora" className="h-8" />
            </Link>
            <Button variant="ghost" onClick={() => window.history.back()}>
              ← Back
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left Side - Content */}
            <div className="space-y-8 lg:pt-8">
              {/* Hero Section */}
              <div className="space-y-6">
                <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                  Let's build together
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Tell us what you have in mind and we'll schedule a personalized demo to show you how to bring it to life with Tulora
                </p>
              </div>

              {/* Illustration */}
              <div className="flex justify-center lg:justify-start">
                <img 
                  src={talkToUsGraphic} 
                  alt="Contact us illustration" 
                  className="w-full max-w-md h-auto"
                />
              </div>
            </div>

            {/* Right Side - Form or Success State */}
            <div className="w-full">
              <Card className="card-glass">
                <CardContent className="p-8">
                  {isSubmitted ? (
                    // Success State
                    <div className="text-center space-y-6">
                      <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                      <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-foreground">
                          Thanks—you're all set.
                        </h2>
                        <p className="text-lg text-muted-foreground">
                          We’ll be in touch soon to review your goals and outline next steps.
                        </p>
                      </div>
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Look for a confirmation email in your inbox. We’ll follow up soon to refine your requirements and outline scope and timeline.
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsSubmitted(false)}
                        className="w-full"
                      >
                        Submit Another Request
                      </Button>
                    </div>
                  ) : (
                     // Form
                     <div>
                       {submitError && (
                         <ApiErrorPanel 
                           error={submitError} 
                           onDismiss={() => setSubmitError(null)}
                         />
                       )}
                       <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Full Name */}
                      <div className="space-y-2">
                        <Label htmlFor="fullName" className="text-foreground font-medium">
                          Full Name *
                        </Label>
                        <Input
                          id="fullName"
                          name="fullName"
                          type="text"
                          placeholder="Your name"
                          value={formData.fullName}
                          onChange={handleInputChange}
                          required
                          className="h-12"
                          disabled={isSubmitting}
                        />
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-foreground font-medium">
                          Email *
                        </Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="name@example.com"
                          value={formData.email}
                          onChange={handleInputChange}
                          required
                          className="h-12"
                          disabled={isSubmitting}
                        />
                      </div>

                       {/* Phone Number - required */}
                       <div className="space-y-2">
                         <Label htmlFor="phone" className="text-foreground font-medium">
                           Phone Number *
                         </Label>
                         <Input
                           id="phone"
                           name="phone"
                           type="tel"
                           placeholder="xxx xxx xxxx"
                           value={formData.phone}
                           onChange={handleInputChange}
                           required
                           className="h-12"
                           disabled={isSubmitting}
                           autoComplete="tel"
                         />
                       </div>

                       {/* Company - required */}
                       <div className="space-y-2">
                         <Label htmlFor="company" className="text-foreground font-medium">
                           Company *
                         </Label>
                         <Input
                           id="company"
                           name="company"
                           type="text"
                           placeholder="Company name"
                           value={formData.company}
                           onChange={handleInputChange}
                           required
                           className="h-12"
                           disabled={isSubmitting}
                         />
                       </div>

                      {/* Project Description */}
                      <div className="space-y-2">
                        <Label htmlFor="project" className="text-foreground font-medium">
                          What would you like to build in Tulora? *
                        </Label>
                        <Textarea
                          id="project"
                          name="project"
                          placeholder="We'll use this to show relevant examples and templates during the demo"
                          value={formData.project}
                          onChange={handleInputChange}
                          required
                          className="min-h-[120px] resize-none"
                          disabled={isSubmitting}
                        />
                      </div>

                       {/* Honeypot field - hidden from users */}
                      <input
                        type="text"
                        name={`website_${Math.random().toString(36).substr(2, 9)}`}
                        value={formData.website}
                        onChange={handleInputChange}
                        style={{ display: 'none' }}
                        tabIndex={-1}
                        autoComplete="off"
                      />

                        {/* Turnstile Widget - Disabled for testing */}
                      {/* <div id="turnstile-widget" className="flex justify-center"></div> */}

                       {/* Submit Button */}
                      <Button 
                        type="submit" 
                        size="lg" 
                        className="w-full h-12 text-lg font-semibold"
                        variant="brand"
                        disabled={isSubmitting || !turnstileToken}
                      >
                         {isSubmitting ? "Sending..." : "Send message"}
                       </Button>
                     </form>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TalkToUs;