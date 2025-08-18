import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Bot, Users2, TrendingUp, Clock } from "lucide-react";

const AIWorkforceV2 = () => {
  const workforceStats = [
    { icon: Bot, value: "500+", label: "AI Agents Deployed" },
    { icon: Users2, value: "50K+", label: "Hours Saved Monthly" },
    { icon: TrendingUp, value: "300%", label: "Productivity Increase" },
    { icon: Clock, value: "24/7", label: "Continuous Operation" },
  ];

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div>
            <Badge variant="outline" className="mb-6">AI Workforce</Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground leading-tight">
              Build your digital workforce in{" "}
              <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                minutes, not months
              </span>
            </h2>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Deploy specialized AI agents that handle complex tasks, learn from your data, 
              and integrate seamlessly with your existing tools and workflows.
            </p>
            
            {/* Features List */}
            <div className="space-y-4 mb-8">
              {[
                "No-code agent builder with drag-and-drop interface",
                "Pre-trained models for common business functions",
                "Real-time learning and adaptation capabilities",
                "Enterprise-grade security and compliance"
              ].map((feature, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                  <span className="text-muted-foreground">{feature}</span>
                </div>
              ))}
            </div>

            <Button size="lg" className="group">
              Build Your Workforce
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-6">
            {workforceStats.map((stat, index) => (
              <Card key={index} className="p-6 border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg">
                <CardContent className="p-0 text-center">
                  <div className="p-3 bg-primary/10 rounded-lg w-fit mx-auto mb-4">
                    <stat.icon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-foreground mb-2">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {stat.label}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AIWorkforceV2;