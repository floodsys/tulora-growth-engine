import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Calendar, CheckCircle } from "lucide-react";
const LiveDemo = () => {
  const [demoStep, setDemoStep] = useState(0);
  const [formData, setFormData] = useState({
    prospect: "",
    company: "",
    product: "",
    message: ""
  });
  const handleDemo = () => {
    if (demoStep < 2) {
      setDemoStep(demoStep + 1);
    } else {
      setDemoStep(0);
    }
  };
  const resetDemo = () => {
    setDemoStep(0);
    setFormData({
      prospect: "",
      company: "",
      product: "",
      message: ""
    });
  };
  return <section className="py-20 bg-gradient-subtle">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4 lg:text-4xl">
              See Tulora in action
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-2xl">
              Try our AI playground to see how Tulora crafts personalized outreach and books meetings
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Interactive Demo Form */}
            <div className="card-glass p-8">
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand" />
                AI Outreach Generator
              </h3>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="prospect">Prospect Name</Label>
                  <Input id="prospect" placeholder="e.g., Sarah Chen" value={formData.prospect} onChange={e => setFormData({
                  ...formData,
                  prospect: e.target.value
                })} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Their Company</Label>
                  <Input id="company" placeholder="e.g., TechFlow Solutions" value={formData.company} onChange={e => setFormData({
                  ...formData,
                  company: e.target.value
                })} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product">Your Product</Label>
                  <Select onValueChange={value => setFormData({
                  ...formData,
                  product: value
                })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your product type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crm">CRM Software</SelectItem>
                      <SelectItem value="marketing">Marketing Platform</SelectItem>
                      <SelectItem value="sales">Sales Tool</SelectItem>
                      <SelectItem value="analytics">Analytics Suite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleDemo} className="w-full btn-primary" disabled={!formData.prospect || !formData.company || !formData.product}>
                  Generate AI Message
                </Button>
              </div>
            </div>

            {/* Demo Results */}
            <div className="card-glass p-8">
              <h3 className="text-xl font-semibold mb-6">AI-Generated Outreach</h3>

              {demoStep === 0 && <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Fill out the form to see Tulora's AI in action</p>
                </div>}

              {demoStep === 1 && <div className="space-y-6 animate-fade-in">
                  <div className="bg-background-secondary rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Personalized Message</h4>
                    <p className="text-sm leading-relaxed">
                      Hi {formData.prospect || "Sarah"},<br /><br />
                      I noticed {formData.company || "TechFlow"} recently expanded your engineering team. 
                      Congrats on the growth!<br /><br />
                      I'm reaching out because many fast-growing companies like yours struggle with 
                      {formData.product === "crm" ? " managing customer relationships at scale" : formData.product === "marketing" ? " coordinating marketing campaigns across teams" : formData.product === "sales" ? " streamlining their sales processes" : " making sense of their data"}.<br /><br />
                      Would you be open to a 15-minute chat about how we've helped similar companies 
                      increase efficiency by 40%?<br /><br />
                      Best,<br />
                      Bradley
                    </p>
                  </div>

                  <Button onClick={handleDemo} className="w-full btn-primary">
                    Generate Follow-up Sequence
                  </Button>
                </div>}

              {demoStep === 2 && <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-semibold">Meeting Booked!</span>
                  </div>

                  <div className="bg-background-secondary rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Smart Follow-up (Day 3)</h4>
                    <p className="text-sm leading-relaxed">
                      Hi {formData.prospect || "Sarah"},<br /><br />
                      Thanks for the quick response! I've found a few time slots that work 
                      for both our calendars:<br /><br />
                      • Tuesday, March 12 at 2:00 PM EST<br />
                      • Wednesday, March 13 at 10:00 AM EST<br />
                      • Thursday, March 14 at 3:00 PM EST<br /><br />
                      I'll send a calendar invite once you confirm. Looking forward to our chat!
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={resetDemo} variant="outline" className="flex-1">
                      Try Again
                    </Button>
                    <Button onClick={() => window.location.href = '/signup'} className="flex-1 btn-primary">
                      Start Free Trial
                    </Button>
                  </div>
                </div>}
            </div>
          </div>
        </div>
      </div>
    </section>;
};
export default LiveDemo;