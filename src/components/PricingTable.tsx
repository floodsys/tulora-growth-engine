import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Sparkles } from "lucide-react";
const PricingTable = () => {
  const [billingCycle, setBillingCycle] = useState("monthly");
  const plans = [{
    name: "Starter",
    price: {
      monthly: 497,
      yearly: 4970
    },
    description: "Perfect for small teams getting started",
    features: ["Up to 500 AI calls/month", "Advanced calendar coordination", "Voice & SMS integrations", "Up to 5 users", "Custom agent templates", "Basic analytics & reporting", "Email support", "Knowledge base integration"],
    limitations: [],
    cta: "Start Trial",
    ctaVariant: "outline" as const,
    popular: false
  }, {
    name: "Business",
    price: {
      monthly: 997,
      yearly: 9970
    },
    description: "For serious sales operations",
    features: ["Unlimited AI calls", "Advanced calendar coordination", "Voice & SMS integrations", "Unlimited users", "Custom templates & sequences", "Advanced analytics & reporting", "CRM integrations (HubSpot, Salesforce)", "Priority support", "A/B testing", "White-label options", "Dedicated account manager"],
    limitations: [],
    cta: "Start Trial",
    ctaVariant: "default" as const,
    popular: true
  }];
  return <section id="pricing" className="py-20 bg-gradient-subtle">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4 lg:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8 text-2xl">
            Start free, upgrade when you're ready to scale. No hidden fees, cancel anytime.
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
              <Button className={`w-full ${plan.ctaVariant === "default" ? "btn-primary" : "btn-secondary"}`} size="lg" onClick={() => window.location.href = '/signup'}>
                {plan.cta}
              </Button>

              <p className="text-xs text-muted-foreground text-center mt-3">
                14-day free trial • No credit card required
              </p>
            </div>)}
        </div>

        {/* Bottom Note */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            Need enterprise features? 
            <a href="/contact" className="text-brand hover:text-brand-dark font-semibold ml-1">
              Contact our sales team
            </a>
          </p>
        </div>
      </div>
    </section>;
};
export default PricingTable;