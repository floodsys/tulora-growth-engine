import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Sparkles, Star } from "lucide-react";

const PricingTable = () => {
  const [billingCycle, setBillingCycle] = useState("monthly");
  
  // Professional pricing: Pro and Business plans only
  const plans = [{
    name: "Pro",
    price: {
      monthly: 99,
      yearly: 1069
    },
    description: "Perfect for growing teams",
    features: [
      "10 AI agents", 
      "20 team seats", 
      "5,000 calls/month", 
      "100GB storage",
      "Advanced analytics", 
      "Voice & SMS integrations", 
      "CRM integrations", 
      "Email support",
      "Knowledge base access"
    ],
    limitations: [],
    cta: "Upgrade to Pro",
    ctaVariant: "outline" as const,
    popular: false,
    planKey: "pro"
  }, {
    name: "Business",
    price: {
      monthly: 299,
      yearly: 3229
    },
    description: "For enterprise operations",
    features: [
      "Unlimited AI agents", 
      "Unlimited team seats", 
      "Unlimited calls", 
      "500GB storage",
      "Advanced analytics", 
      "Voice & SMS integrations", 
      "All CRM integrations",
      "White-label options",
      "API access", 
      "Priority support",
      "Account manager",
      "Custom integrations"
    ],
    limitations: [],
    cta: "Upgrade to Business",
    ctaVariant: "default" as const,
    popular: true,
    planKey: "business"
  }];
  return <section id="pricing" className="py-20 bg-gradient-subtle">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4 lg:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8 text-2xl">
            Professional-grade AI sales automation. 14-day free trial, cancel anytime.
          </p>

          {/* Billing Toggle */}
          <Tabs value={billingCycle} onValueChange={setBillingCycle} className="inline-flex">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly" className="relative">
                Yearly
                <Badge variant="secondary" className="ml-2 text-xs">
                  Save 33%
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => <div key={index} className={`relative card-glass p-8 ${plan.popular ? "ring-2 ring-brand shadow-brand" : ""}`}>
              {plan.popular && <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-gradient-brand text-brand-foreground px-4 py-1">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>}

              {/* Plan Header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-foreground">
                    ${billingCycle === "yearly" ? Math.round(plan.price.yearly / 12) : plan.price.monthly}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                  {billingCycle === "yearly" && plan.price.yearly > 0 && <div className="text-sm text-muted-foreground mt-1">
                      Billed yearly (${plan.price.yearly})
                    </div>}
                </div>
                <p className="text-muted-foreground">{plan.description}</p>
              </div>

              {/* Features */}
              <div className="space-y-4 mb-8">
                <h4 className="font-semibold text-foreground">What's included:</h4>
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => <li key={featureIndex} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{feature}</span>
                    </li>)}
                </ul>
              </div>

              {/* CTA */}
              <Button 
                className={`w-full ${plan.ctaVariant === "default" ? "btn-primary" : "btn-secondary"}`} 
                size="lg" 
                onClick={() => {
                  // Redirect to signup with plan selection
                  const params = new URLSearchParams({
                    plan: plan.planKey,
                    interval: billingCycle === 'yearly' ? 'year' : 'month'
                  })
                  window.location.href = `/signup?${params.toString()}`
                }}
              >
                {plan.cta}
              </Button>

              <p className="text-xs text-muted-foreground text-center mt-3">
                No credit card required for trial
              </p>
            </div>)}
        </div>

        {/* Bottom Note */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            Need custom enterprise solutions? 
            <a href="/contact" className="text-brand hover:text-brand-dark font-semibold ml-1">
              Contact our sales team
            </a>
          </p>
          
          {/* Demo Sandbox CTA */}
          <div className="mt-8 p-6 border border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <h3 className="font-semibold">Try Our Demo Sandbox</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Experience our AI sales automation with pre-configured demo agents and sample data
            </p>
            <Button variant="outline" onClick={() => window.location.href = '/demo'}>
              Launch Demo Sandbox
            </Button>
          </div>
        </div>
      </div>
    </section>;
};
export default PricingTable;