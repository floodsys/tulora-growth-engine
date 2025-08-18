import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Play, Sparkles, Zap, Brain } from "lucide-react";
import heroCodingImage from "@/assets/hero-coding.svg";

const Hero = () => {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      
      {/* Top Banner */}
      <div className="relative z-10 pt-8 pb-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <Badge variant="secondary" className="mb-8 px-4 py-2 text-sm font-medium bg-primary/10 text-primary border-primary/20">
            <Sparkles className="w-4 h-4 mr-2" />
            Early Access
          </Badge>
        </div>
      </div>

      {/* Main Hero Content */}
      <div className="relative z-10 pt-8 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Content */}
            <div className="space-y-8">
              {/* Main Heading */}
              <h1 className="text-5xl lg:text-6xl font-bold text-foreground leading-tight font-heading">
                Build teams of{" "}
                <span className="bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent animate-gradient">
                  AI agents
                </span>{" "}
                that deliver human-quality work
              </h1>

              {/* Subtitle */}
              <p className="text-xl lg:text-2xl text-muted-foreground leading-relaxed max-w-2xl">
                AI agents automate workflows, save time, and grow your business.
              </p>

              {/* Feature highlights */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center space-x-2 bg-primary/5 px-4 py-2 rounded-full border border-primary/20">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-foreground font-medium">Rapid time-to-value</span>
                </div>
                <div className="flex items-center space-x-2 bg-purple-500/5 px-4 py-2 rounded-full border border-purple-500/20">
                  <Brain className="w-4 h-4 text-purple-600" />
                  <span className="text-foreground font-medium">Configure, don't code</span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-start gap-4 pt-4">
                <Button 
                  size="lg" 
                  className="px-8 py-4 text-lg font-semibold bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Start Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="px-8 py-4 text-lg font-semibold bg-white/50 backdrop-blur-sm border-2 border-primary/20 hover:bg-primary/5 hover:border-primary/40 transition-all duration-300"
                >
                  <Play className="mr-2 w-5 h-5" />
                  Book Demo
                </Button>
              </div>

              {/* Social proof */}
              <div className="pt-8 border-t border-border/50">
                <p className="text-sm text-muted-foreground mb-4">Trusted by forward-thinking teams</p>
                <div className="flex items-center space-x-8 opacity-60">
                  <div className="text-2xl font-bold text-foreground">100+</div>
                  <div className="text-sm text-muted-foreground">AI Agents<br/>Deployed</div>
                  <div className="text-2xl font-bold text-foreground">95%</div>
                  <div className="text-sm text-muted-foreground">Success<br/>Rate</div>
                </div>
              </div>
            </div>

            {/* Right Side - Illustration */}
            <div className="relative">
              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-r from-primary to-purple-600 rounded-2xl blur-xl opacity-20 animate-float"></div>
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-r from-blue-500 to-primary rounded-full blur-2xl opacity-15 animate-float delay-500"></div>
              
              {/* Main illustration */}
              <div className="relative z-10 bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm rounded-3xl p-8 border border-white/20 shadow-2xl">
                <img 
                  src={heroCodingImage} 
                  alt="AI coding illustration" 
                  className="w-full h-auto max-w-md mx-auto"
                />
              </div>

              {/* Floating info cards */}
              <div className="absolute top-8 -left-8 bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-white/20 animate-float delay-200">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FFEE58' }}>
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Agent Deployed</div>
                    <div className="text-xs text-muted-foreground">99.9% uptime</div>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-8 -right-8 bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-white/20 animate-float delay-700">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Learning</div>
                    <div className="text-xs text-muted-foreground">24/7 active</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;