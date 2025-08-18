import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, User, Wrench, GraduationCap, BarChart3 } from "lucide-react";
const AIWorkforceV2 = () => {
  const serviceFeatures = [{
    icon: User,
    title: "Dedicated AI Engineer",
    description: "Your personal AI specialist working exclusively on your project"
  }, {
    icon: Wrench,
    title: "Custom Agent Implementation",
    description: "Tailored AI agents built specifically for your business needs"
  }, {
    icon: GraduationCap,
    title: "AI Agent Training",
    description: "Comprehensive training on your data and business processes"
  }, {
    icon: BarChart3,
    title: "Agent Performance Audit",
    description: "Continuous monitoring and optimization of your AI workforce"
  }];
  return <section className="py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground leading-tight">
              Build your digital workforce with{" "}
              <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                expert guidance
              </span>
            </h2>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Get a dedicated AI engineer who will build, train, and optimize custom AI agents 
              specifically designed for your business. From consultation to deployment and beyond.
            </p>
            
            {/* Process Steps */}
            <div className="space-y-4 mb-8">
              {["Schedule a personalized demo call", "AI engineer analyzes your business needs", "Custom agent development and training", "Ongoing performance monitoring and optimization"].map((step, index) => <div key={index} className="flex items-center">
                  <div className="w-6 h-6 bg-primary rounded-full mr-3 flex items-center justify-center text-white text-sm font-semibold">
                    {index + 1}
                  </div>
                  <span className="text-muted-foreground">{step}</span>
                </div>)}
            </div>

            <Button size="lg" className="group">
              Schedule Demo Call
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Service Features */}
          <div className="grid grid-cols-1 gap-6">
            {serviceFeatures.map((feature, index) => <Card key={index} className="p-6 border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg">
                <CardContent className="p-0">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>)}
          </div>
        </div>
      </div>
    </section>;
};
export default AIWorkforceV2;