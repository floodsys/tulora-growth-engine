import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, ArrowLeft, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export default function ContactSales() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    product_line: searchParams.get("product") || "leadgen",
    expected_volume: "",
    notes: ""
  });

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
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('contact-sales', {
        body: formData,
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`
        } : undefined
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: "Request Submitted",
        description: "Thank you! Our sales team will contact you within 24 hours.",
      });

    } catch (error: any) {
      console.error('Contact sales error:', error);
      toast({
        title: "Submission Error",
        description: error.message || "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getProductLineDisplay = (productLine: string) => {
    return productLine === 'leadgen' ? 'AI Lead Generation' : 'AI Customer Service';
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
                  Thank You!
                </h1>
                <p className="text-green-700 mb-6">
                  We've received your enterprise inquiry for <strong>{getProductLineDisplay(formData.product_line)}</strong>.
                  Our sales team will review your requirements and contact you within 24 hours.
                </p>
                <div className="space-y-4">
                  <div className="text-sm text-green-600 bg-green-100 p-4 rounded-lg">
                    <p><strong>What happens next:</strong></p>
                    <ul className="text-left mt-2 space-y-1">
                      <li>• Sales team reviews your requirements</li>
                      <li>• Custom demo scheduled based on your needs</li>
                      <li>• Tailored pricing and implementation plan</li>
                    </ul>
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
                  <Label htmlFor="product_line">Product Interest *</Label>
                  <Select value={formData.product_line} onValueChange={(value) => handleInputChange('product_line', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leadgen">AI Lead Generation</SelectItem>
                      <SelectItem value="support">AI Customer Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="expected_volume">Expected Volume</Label>
                  <Select value={formData.expected_volume} onValueChange={(value) => handleInputChange('expected_volume', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select expected usage volume" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="< 5,000 calls/month">&lt; 5,000 calls/month</SelectItem>
                      <SelectItem value="5,000-20,000 calls/month">5,000-20,000 calls/month</SelectItem>
                      <SelectItem value="20,000-100,000 calls/month">20,000-100,000 calls/month</SelectItem>
                      <SelectItem value="> 100,000 calls/month">&gt; 100,000 calls/month</SelectItem>
                      <SelectItem value="Custom/Variable">Custom/Variable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="notes">Additional Requirements *</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Tell us about your specific needs, compliance requirements, integration needs, or any other details..."
                    rows={4}
                    required
                  />
                </div>

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
                    disabled={isSubmitting || !formData.name || !formData.email || !formData.company || !formData.notes}
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