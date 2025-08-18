import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, MessageSquare, BarChart3, Shield, Zap, Globe } from "lucide-react";

const FeaturesV2 = () => {
  const features = [
    {
      icon: Brain,
      title: "Advanced AI Engine",
      description: "State-of-the-art machine learning algorithms that adapt and improve over time.",
      badge: "Core Feature"
    },
    {
      icon: MessageSquare,
      title: "Natural Conversations", 
      description: "Human-like interactions that understand context and nuance.",
      badge: "Popular"
    },
    {
      icon: BarChart3,
      title: "Real-time Analytics",
      description: "Comprehensive insights and performance metrics at your fingertips.",
      badge: "Enterprise"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-grade encryption and compliance with industry standards.",
      badge: "Secure"
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Sub-second response times with global edge computing infrastructure.",
      badge: "Performance"
    },
    {
      icon: Globe,
      title: "Global Scale",
      description: "Deploy worldwide with automatic scaling and load balancing.",
      badge: "Scalable"
    }
  ];

  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">Features</Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
            Everything you need to succeed
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Powerful features designed to accelerate your workflow and maximize productivity.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg group">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg w-fit">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {feature.badge}
                  </Badge>
                </div>
                <CardTitle className="text-xl group-hover:text-primary transition-colors">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesV2;