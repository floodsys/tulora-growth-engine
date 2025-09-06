import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Star, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PricingTable = () => {
  const [activeTab, setActiveTab] = useState("leadgen");
  const [currentOrgPlan, setCurrentOrgPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Check current organization's plan
  useEffect(() => {
    const checkCurrentPlan = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get user's current org and subscription
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, plan_key')
          .eq('owner_user_id', user.id)
          .limit(1);

        if (orgs && orgs.length > 0) {
          setCurrentOrgPlan(orgs[0].plan_key);
        }
      } catch (error) {
        console.error('Error checking current plan:', error);
      }
    };

    checkCurrentPlan();
  }, []);

  const handleGetStarted = async (planKey: string) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/auth';
        return;
      }

      // Get user's organization
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_user_id', user.id)
        .limit(1);

      if (!orgs || orgs.length === 0) {
        toast({
          title: "Organization Required",
          description: "Please complete your organization setup first.",
          variant: "destructive",
        });
        return;
      }

      // Call create-org-checkout
      const { data } = await supabase.functions.invoke('create-org-checkout', {
        body: {
          orgId: orgs[0].id,
          planKey,
          interval: 'monthly',
          seats: 1
        }
      });

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: orgs } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_user_id', user.id)
        .limit(1);

      if (!orgs || orgs.length === 0) return;

      const { data } = await supabase.functions.invoke('org-customer-portal', {
        body: { orgId: orgs[0].id }
      });

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Portal error:', error);
      toast({
        title: "Error",
        description: "Failed to open customer portal.",
        variant: "destructive",
      });
    }
  };

  const leadGenPlans = [
    {
      planKey: "leadgen_starter",
      name: "Starter",
      subtitle: "Single-location growth",
      setupFee: "$10,000",
      monthlyPrice: "$2,500",
      includedUsage: ["500 minutes", "10,000 AI messages / mo"],
      modelMix: "Non-Realtime (voice engine + reasoning-optimized LLM)",
      features: [
        "5 video concepts × 3 variants",
        "Landing pages",
        "1 phone agent emergency mode FAQs",
        "Calendar CRM job wiring",
        "Basic analytics",
        "Monthly performance review"
      ]
    },
    {
      planKey: "leadgen_business",
      name: "Business",
      subtitle: "Multi-location or higher volume",
      setupFee: "$10,000",
      monthlyPrice: "$3,500",
      includedUsage: ["2,000 minutes", "50,000 messages / mo"],
      modelMix: "Non-Realtime",
      features: [
        "15 video concepts",
        "Multi-channel kit (Meta, Google, TikTok)",
        "Advanced flows: multi-service, bilingual, re-engagement",
        "2-3 agents (brands/regions)",
        "Advanced analytics",
        "Weekly optimization"
      ],
      popular: true
    },
    {
      planKey: "leadgen_enterprise_performance",
      name: "Enterprise Performance",
      subtitle: "Pay mostly for outcomes",
      setupFee: "Custom",
      monthlyPrice: "Low retainer (TBD)",
      includedUsage: ["Outcome-based pricing"],
      modelMix: "Qualified leads $75–$300, Booked appointments $200–$500, Revenue share 3–10%",
      features: [
        "Outcome pricing",
        "SOW-governed qualification",
        "Verification and caps"
      ],
      isEnterprise: true
    }
  ];

  const supportPlans = [
    {
      planKey: "support_starter",
      name: "Starter",
      subtitle: "Single-location / business hours",
      setupFee: "$8,000",
      monthlyPrice: "$1,500",
      includedUsage: ["1,000 minutes", "10,000 messages / mo"],
      modelMix: "Non-Realtime",
      features: [
        "1 voice agent, 1 brand line",
        "Emergency triage FAQs",
        "1 helpdesk CRM integration",
        "Basic analytics (containment, FCR, AHT)",
        "Monthly report"
      ]
    },
    {
      planKey: "support_business",
      name: "Business",
      subtitle: "Multi-location or 24/7",
      setupFee: "$10,000",
      monthlyPrice: "$3,500",
      includedUsage: ["4,000 minutes", "50,000 messages / mo"],
      modelMix: "Non-Realtime",
      features: [
        "2-3 agents (brands/queues)",
        "Bilingual (up to 2 languages)",
        "Advanced workflows: returns, billing, scheduling, callback",
        "2+ integrations",
        "QA dashboards",
        "Weekly optimization"
      ],
      popular: true
    },
    {
      planKey: "support_enterprise",
      name: "Enterprise",
      subtitle: "Regulated / high scale",
      setupFee: "Custom",
      monthlyPrice: "$10,000+/mo",
      includedUsage: ["Platform retainer"],
      modelMix: "HIPAA/PCI options, custom voice tuning",
      features: [
        "HIPAA/PCI options",
        "Custom voice tuning",
        "IVR trees by department",
        "Data residency",
        "Dedicated account manager"
      ],
      isEnterprise: true
    }
  ];

  const getFootnote = (tab: string) => {
    if (tab === "leadgen") {
      return "Minutes (Default mix) $0.20/min · Minutes (Realtime, opt-in) $0.60/min · AI agent messages $0.009/msg · SMS & phone numbers / Verified Caller ID / Concurrency: pass-through +20%. Unused included usage does not roll over. Caps & email alerts enabled before overages.";
    } else {
      return "Minutes (Default mix) $0.25/min · Minutes (Realtime, opt-in) $0.60/min · AI agent messages $0.009/msg · SMS & phone numbers / Verified Caller ID / Concurrency: pass-through +20%. Unused included usage does not roll over. Caps & alerts enabled before overages. Realtime is opt-in per queue.";
    }
  };

  const renderPlanCard = (plan: any) => {
    const isActivePlan = currentOrgPlan === plan.planKey;
    
    return (
      <div key={plan.planKey} className={`relative bg-card border border-border rounded-xl p-8 ${plan.popular ? "ring-2 ring-primary shadow-lg" : ""}`}>
        {plan.popular && (
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
            <Badge className="bg-primary text-primary-foreground px-4 py-1">
              <Star className="h-3 w-3 mr-1" />
              Most Popular
            </Badge>
          </div>
        )}

        {isActivePlan && (
          <div className="absolute -top-4 right-4">
            <Badge variant="secondary" className="px-3 py-1">
              Active
            </Badge>
          </div>
        )}

        {/* Plan Header */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-foreground mb-1">{plan.name}</h3>
          <p className="text-sm text-muted-foreground mb-4">{plan.subtitle}</p>
          
          <div className="mb-4">
            <div className="text-sm text-muted-foreground">Setup: {plan.setupFee}</div>
            <div className="text-3xl font-bold text-foreground">{plan.monthlyPrice}</div>
            {!plan.isEnterprise && <div className="text-sm text-muted-foreground">per month</div>}
          </div>
        </div>

        {/* Included Usage */}
        <div className="mb-6">
          <h4 className="font-semibold text-foreground mb-2">Included usage:</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            {plan.includedUsage.map((usage: string, idx: number) => (
              <div key={idx}>{usage}</div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Model mix (default): {plan.modelMix}
          </div>
        </div>

        {/* Features */}
        <div className="space-y-3 mb-8">
          <h4 className="font-semibold text-foreground">Features:</h4>
          <ul className="space-y-2">
            {plan.features.map((feature: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        {isActivePlan ? (
          <Button 
            className="w-full" 
            variant="outline"
            onClick={handleManageSubscription}
          >
            Manage in portal
          </Button>
        ) : plan.isEnterprise ? (
          <Button 
            className="w-full" 
            variant="outline"
            onClick={() => window.location.href = `/contact/sales?product=${activeTab}`}
          >
            Contact sales
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button 
            className="w-full" 
            onClick={() => handleGetStarted(plan.planKey)}
            disabled={isLoading}
          >
            Get started
          </Button>
        )}
      </div>
    );
  };

  return (
    <section id="pricing" className="py-20 bg-gradient-subtle">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4 lg:text-4xl">
            AI Solutions Pricing
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8 text-lg">
            Choose the right AI solution for your business needs
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-6xl mx-auto">
          <TabsList className="grid w-full grid-cols-2 mb-12 max-w-md mx-auto">
            <TabsTrigger value="leadgen">AI Lead Gen</TabsTrigger>
            <TabsTrigger value="support">AI Customer Service</TabsTrigger>
          </TabsList>

          <TabsContent value="leadgen" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {leadGenPlans.map(renderPlanCard)}
            </div>
            <div className="text-xs text-muted-foreground bg-muted/20 p-4 rounded-lg">
              <strong>Lead Gen Pricing:</strong> {getFootnote("leadgen")}
            </div>
          </TabsContent>

          <TabsContent value="support" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {supportPlans.map(renderPlanCard)}
            </div>
            <div className="text-xs text-muted-foreground bg-muted/20 p-4 rounded-lg">
              <strong>Support Pricing:</strong> {getFootnote("support")}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
};

export default PricingTable;