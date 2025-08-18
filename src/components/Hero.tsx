import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Play } from "lucide-react";
const Hero = () => {
  return <div className="relative min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Top Banner */}
      

      {/* Main Hero Content */}
      <div className="pt-20 pb-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          {/* Decorative Elements */}
          
          

          {/* Main Heading */}
          <h1 className="text-5xl lg:text-7xl font-bold text-foreground mb-8 max-w-5xl mx-auto leading-tight font-heading">
            Build teams of{" "}
            <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              AI agents
            </span>{" "}
            that deliver human-quality work
          </h1>

          {/* Subtitle */}
          <p className="text-xl lg:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            Ops teams can build and manage an entire AI workforce in one powerful visual platform.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button size="lg" className="px-8 py-4 text-lg font-semibold bg-primary hover:bg-primary/90">
              Try for free
            </Button>
            <Button variant="outline" size="lg" className="px-8 py-4 text-lg font-semibold bg-white text-foreground border-border hover:bg-gray-50">
              Request a demo
            </Button>
          </div>

          {/* Navigation Pills */}
          

          {/* Dashboard Preview */}
          <div className="relative max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-border overflow-hidden">
              {/* Browser Chrome */}
              
              
              {/* Dashboard Content */}
              
            </div>
          </div>
        </div>
      </div>
    </div>;
};
export default Hero;