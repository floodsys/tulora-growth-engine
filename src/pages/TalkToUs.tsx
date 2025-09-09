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
import contactUsImage from "@/assets/contact-us.svg";
import talkToUsGraphic from "@/assets/talk-to-us-graphic.png";
import logoSvg from "@/assets/logo.svg";
// import { useTurnstile } from "@/hooks/useTurnstile";


const TalkToUs = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Anti-spam: Check honeypot field
    if (formData.website) {
      // Silent fail for bot submissions
      return;
    }

    // Turnstile disabled for testing
    // if (!turnstileToken) {
    //   toast({
    //     title: "Please complete verification",
    //     description: "Please complete the security check to continue",
    //     variant: "destructive"
    //   });
    //   return;
    // }
    
    // Basic validation
    if (!formData.fullName || !formData.email || !formData.phone || !formData.company || !formData.project) {
      toast({
        title: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        inquiry_type: 'contact',
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        company: formData.company,
        message: formData.project,
        accept_privacy: true,
        marketing_opt_in: false,
        turnstile_token: turnstileToken
      };

      const res = await fetch('/functions/v1/contact-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let data: any = null;
      try { 
        data = await res.json(); 
      } catch { 
        data = null; 
      }

      if (!res.ok) {
        const msg = data?.error || `Request failed (${res.status})`;
        
        // Handle Turnstile-specific errors
        if (data?.code === "turnstile_missing" || data?.code === "turnstile_failed") {
          toast({
            title: "Security verification required",
            description: "Please complete the security check to continue",
            variant: "destructive"
          });
          return;
        }
        
        toast({
          title: "Failed to send message",
          description: msg,
          variant: "destructive"
        });
        return;
      }

      if (data && data.ok) {
        setIsSubmitted(true);
        // Reset form
        setFormData({
          fullName: "",
          email: "",
          phone: "",
          company: "",
          project: "",
          website: ""
        });
        toast({
          title: "Message sent successfully",
          description: "Thanks — we received your message.",
          variant: "default"
        });
      } else {
        // Handle the odd case of 2xx but no JSON or ok:false
        toast({
          title: "Message submitted",
          description: "Thanks — submitted.",
          variant: "default"
        });
      }
    } catch (error: any) {
      console.error('Contact form error:', error);
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again later",
        variant: "destructive"
      });
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
                          Thanks!
                        </h2>
                        <p className="text-lg text-muted-foreground">
                          We'll reach out to schedule your demo.
                        </p>
                      </div>
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Look for a confirmation email in your inbox. We'll email you soon to schedule a personalized demo of our AI lead generation platform.
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

                      {/* Phone Number */}
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-foreground font-medium">
                          Phone Number *
                        </Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="605-500-0123"
                          value={formData.phone}
                          onChange={handleInputChange}
                          required
                          className="h-12"
                          disabled={isSubmitting}
                        />
                      </div>

                      {/* Company */}
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
                        name="website"
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
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Sending..." : "Send message"}
                      </Button>
                    </form>
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