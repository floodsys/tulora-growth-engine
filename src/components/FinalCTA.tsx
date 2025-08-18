import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
const FinalCTA = () => {
  return <section className="py-20 bg-gradient-brand relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-4xl mx-auto">
          {/* Headline */}
          <h2 className="text-3xl lg:text-5xl font-bold text-brand-foreground mb-6 leading-tight">
            Ready to book 3× more meetings?
          </h2>
          
          {/* Subheadline */}
          <p className="text-xl text-brand-foreground/90 mb-8 max-w-2xl mx-auto leading-relaxed">Elevate your business to new heights of success with AI today!</p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button size="lg" className="bg-white text-brand hover:bg-gray-50 px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1" onClick={() => window.location.href = '/auth'}>
              Start Free
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Button variant="outline" size="lg" className="bg-white border-brand-foreground/30 text-black hover:bg-gray-50 px-8 py-4 text-lg font-semibold backdrop-blur-sm" onClick={() => window.location.href = '/talk-to-us'}>
              Book Demo
            </Button>
          </div>

          {/* Trust signals */}
          <div className="space-y-2 text-brand-foreground/80">
            
            
          </div>
        </div>
      </div>
    </section>;
};
export default FinalCTA;