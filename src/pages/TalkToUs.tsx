import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import contactUsImage from "@/assets/contact-us.svg";

const TalkToUs = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    company: "",
    project: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.fullName || !formData.email || !formData.phone || !formData.company || !formData.project) {
      toast({
        title: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Here you would typically send the data to your backend
    console.log("Form submitted:", formData);
    
    toast({
      title: "Thank you for reaching out!",
      description: "We'll be in touch soon to schedule your personalized demo."
    });

    // Reset form
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      company: "",
      project: ""
    });
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="py-6 px-4 sm:px-6 lg:px-8 border-b border-border/20">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-primary">Tulora</h1>
            <Button variant="ghost" onClick={() => window.history.back()}>
              ← Back
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Content */}
            <div className="space-y-8">
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
                  src={contactUsImage} 
                  alt="Contact us illustration" 
                  className="w-full max-w-md h-auto"
                  style={{ filter: 'hue-rotate(210deg) saturate(1.2)' }}
                />
              </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full">
              <Card className="card-glass">
                <CardContent className="p-8">
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
                      />
                    </div>

                    {/* Submit Button */}
                    <Button 
                      type="submit" 
                      size="lg" 
                      className="w-full h-12 text-lg font-semibold"
                      variant="brand"
                    >
                      Schedule Demo Call
                    </Button>
                  </form>
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