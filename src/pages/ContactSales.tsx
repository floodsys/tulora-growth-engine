import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, ArrowLeft, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { buildContactPayload, validateContactPayload } from "@/lib/contact-payload";
import { ApiErrorPanel } from "@/components/ui/ApiErrorPanel";
import { CONTACT_SALES_FN } from "@/lib/constants";
import { SUPABASE_URL, SUPABASE_ANON } from "@/config/publicConfig";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
// import { useTurnstile } from "@/hooks/useTurnstile";

export default function ContactSales() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    product_interest: [] as string[], // Multi-select array
    expected_volume: "",
    additional_requirements: "",
    // Honeypot field - should remain empty
    website: ""
  });

  // Disable Turnstile for testing
  // const { token: turnstileToken, isReady: turnstileReady } = useTurnstile('turnstile-widget-contact', { theme: 'light' });
  const turnstileToken = "test-token"; // Mock token for testing
  const turnstileReady = true;

  // Check if enterprise extras are required (default false)
  const requireEnterpriseExtras = false; // This would typically come from an environment variable or config

  useEffect(() => {
    // Pre-fill user data if authenticated
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setFormData(prev => ({
            ...prev,
            email: user.email || "",
            name: user.user_metadata?.full_name || user.user_metadata?.name || ""
          }));
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();

    // Pre-fill product interest from URL params
    const productParam = searchParams.get("product");
    if (productParam) {
      const productMap: Record<string, string> = {
        'leadgen': 'AI Lead Generation',
        'support': 'AI Customer Service'
      };
      const productInterest = productMap[productParam] || productParam;
      setFormData(prev => ({
        ...prev,
        product_interest: [productInterest]
      }));
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('CONTACT_SUBMIT start');
    
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
    
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Build canonical payload - only required keys for enterprise
      const payload = buildContactPayload('enterprise', {
        name: formData.name, // maps to full_name
        email: formData.email,
        message: formData.additional_requirements, // map textarea directly to message
        // Optional fields
        company: formData.company,
        product_interest: formData.product_interest.join(', '),
        expected_volume: formData.expected_volume,
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
        toast({
          title: "Request Submitted",
          description: "Thank you! Our sales team will contact you within 24 hours.",
        });
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

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleProductInterestChange = (product: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      product_interest: checked 
        ? [...prev.product_interest, product]
        : prev.product_interest.filter(p => p !== product)
    }));
  };

  const getProductInterestDisplay = (products: string[]) => {
    return products.length > 0 ? products.join(', ') : 'No products selected';
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        
        <main className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-8">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-green-900 mb-4">
                  Thanks!
                </h1>
                <p className="text-green-700 mb-6">
                  An enterprise specialist will contact you shortly to discuss your {getProductInterestDisplay(formData.product_interest)} requirements and pricing.
                </p>
                <div className="space-y-4">
                  <div className="text-sm text-green-600 bg-green-100 p-4 rounded-lg">
                    <p><strong>We've sent you a confirmation email with next steps.</strong></p>
                    <p className="mt-2">Our enterprise team will follow up shortly to discuss requirements and pricing for your {getProductInterestDisplay(formData.product_interest)} solution.</p>
                  </div>
                  <div className="flex gap-4 justify-center">
                    <Button onClick={() => navigate('/')} variant="outline">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Home
                    </Button>
                    <Button onClick={() => navigate('/pricing')}>
                      View All Plans
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-4">
              Contact Enterprise Sales
            </h1>
            <p className="text-muted-foreground">
              Get in touch for enterprise pricing and custom solutions for your business
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Enterprise Inquiry</CardTitle>
            </CardHeader>
            <CardContent>
              {submitError && (
                <ApiErrorPanel 
                  error={submitError} 
                  onDismiss={() => setSubmitError(null)}
                />
              )}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="company">Company Name *</Label>
                  <Input
                    id="company"
                    type="text"
                    value={formData.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    placeholder="Your organization name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="product_interest">Product Interest {requireEnterpriseExtras ? '*' : '(Optional)'}</Label>
                  <div className="space-y-2 mt-2">
                    {[
                      'AI Lead Generation',
                      'AI Customer Service'
                    ].map(product => (
                      <div key={product} className="flex items-center space-x-2">
                        <Checkbox
                          id={`product_${product.replace(/\s+/g, '_').toLowerCase()}`}
                          checked={formData.product_interest.includes(product)}
                          onCheckedChange={(checked) => handleProductInterestChange(product, checked as boolean)}
                        />
                        <Label 
                          htmlFor={`product_${product.replace(/\s+/g, '_').toLowerCase()}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {product}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="expected_volume">Expected Volume {requireEnterpriseExtras ? '*' : '(Optional)'}</Label>
                  <Select 
                    value={formData.expected_volume} 
                    onValueChange={(value) => handleInputChange('expected_volume', value)}
                  >
                    <SelectTrigger className="z-50">
                      <SelectValue placeholder="Select expected usage volume" />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-background border shadow-lg">
                      <SelectItem value="< 5,000 calls/month">&lt; 5,000 calls/month</SelectItem>
                      <SelectItem value="5,000-20,000 calls/month">5,000-20,000 calls/month</SelectItem>
                      <SelectItem value="20,000-100,000 calls/month">20,000-100,000 calls/month</SelectItem>
                      <SelectItem value="> 100,000 calls/month">&gt; 100,000 calls/month</SelectItem>
                      <SelectItem value="Custom/Variable">Custom/Variable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="additional_requirements">Message *</Label>
                  <Textarea
                    id="additional_requirements"
                    value={formData.additional_requirements}
                    onChange={(e) => handleInputChange('additional_requirements', e.target.value)}
                    placeholder="Describe your requirements, goals, or any specific questions..."
                    rows={4}
                    className="resize-none"
                    required
                  />
                </div>

                {/* Honeypot field - hidden from users */}
                <input
                  type="text"
                  name="website"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  style={{ display: 'none' }}
                  tabIndex={-1}
                  autoComplete="off"
                />

                {/* Turnstile Widget - Disabled for testing */}
                {/* <div id="turnstile-widget-contact" className="flex justify-center"></div> */}

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/pricing')}
                    className="flex-1"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Pricing
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      isSubmitting || 
                      !turnstileToken || 
                      !turnstileReady || 
                      !formData.name || 
                      !formData.email || 
                      !formData.company ||
                      !formData.additional_requirements ||
                      (requireEnterpriseExtras && (
                        formData.product_interest.length === 0 ||
                        !formData.expected_volume
                      ))
                    }
                    className="flex-1"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}