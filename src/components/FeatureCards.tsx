import { Calendar, MessageSquare, Target, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const FeatureCards = () => {
  const features = [
    {
      icon: <MessageSquare className="h-8 w-8 text-brand" />,
      problem: "Cold outreach gets ignored",
      outcome: "Book 3× more qualified demos",
      how: "AI personalizes every message using prospect data and context",
      anchor: "smart-outreach"
    },
    {
      icon: <Calendar className="h-8 w-8 text-brand" />,
      problem: "Scheduling back-and-forth wastes time",
      outcome: "Zero-touch calendar coordination",
      how: "Smart scheduling considers timezones, preferences, and availability",
      anchor: "auto-scheduling"
    },
    {
      icon: <Target className="h-8 w-8 text-brand" />,
      problem: "Prospects go cold after initial interest",
      outcome: "80% follow-up response rate",
      how: "Intelligent nurture sequences adapt based on engagement",
      anchor: "smart-followup"
    }
  ];

  return (
    <section id="features" className="py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Turn prospects into booked meetings
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stop chasing prospects. Let AI handle the heavy lifting while you focus on closing deals.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="card-glass p-8 hover:shadow-brand transition-all duration-300 group cursor-pointer"
              onClick={() => document.getElementById(feature.anchor)?.scrollIntoView({ behavior: 'smooth' })}
            >
              {/* Icon */}
              <div className="mb-6">
                <div className="w-16 h-16 bg-brand/10 rounded-xl flex items-center justify-center group-hover:bg-brand/20 transition-colors duration-300">
                  {feature.icon}
                </div>
              </div>

              {/* Content */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">Problem</p>
                  <p className="text-foreground">{feature.problem}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-brand font-medium">Outcome</p>
                  <p className="text-lg font-semibold text-foreground">{feature.outcome}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">How it works</p>
                  <p className="text-foreground">{feature.how}</p>
                </div>

                {/* CTA */}
                <Button
                  variant="ghost"
                  className="group-hover:text-brand transition-colors duration-300 p-0 h-auto font-semibold"
                >
                  Learn more
                  <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform duration-300" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureCards;