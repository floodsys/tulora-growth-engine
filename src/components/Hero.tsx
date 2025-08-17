import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

const Hero = () => {
  // Placeholder company logos
  const trustLogos = [
    "Acme Corp", "TechFlow", "InnovateCo", "BuildSpace", "ScaleUp", "Future Labs"
  ];

  return (
    <section className="relative py-20 lg:py-32 gradient-hero overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-4xl mx-auto">
          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
            Book 3× more meetings with{" "}
            <span className="bg-gradient-brand bg-clip-text text-transparent">
              AI scheduling
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl lg:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Transform cold outreach into booked demos with Tulora's AI that handles 
            scheduling, follow-ups, and calendar coordination automatically.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button 
              size="lg" 
              className="btn-primary px-8 py-4 text-lg font-semibold"
              onClick={() => window.location.href = '/signup'}
            >
              Start free — no credit card
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="btn-secondary px-8 py-4 text-lg font-semibold flex items-center gap-2"
              onClick={() => window.location.href = '/demo'}
            >
              <Play className="h-5 w-5" />
              Book a demo
            </Button>
          </div>

          {/* Trust Bar */}
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Loved by sales teams at growing companies
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
              {trustLogos.map((logo, index) => (
                <div
                  key={index}
                  className="px-4 py-2 bg-card/50 backdrop-blur-sm rounded-lg border border-border/30"
                >
                  <span className="text-sm font-medium text-muted-foreground">
                    {logo}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;