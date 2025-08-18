import { Card, CardContent } from "@/components/ui/card";

const InfoSection = () => {
  const features = [
    {
      title: "All-in-one multi-agent platform",
      description: "A flexible, multi-agent platform built for any use case, across any industry."
    },
    {
      title: "Built for business-critical tasks", 
      description: "Built for high-stakes tasks that drive real results, — intelligent automation, not just a bot."
    },
    {
      title: "Delivers human-quality work",
      description: "Powerful, intelligent automation that matches the quality and precision of top human talent."
    },
    {
      title: "Works the way you do",
      description: "Fully customizable workflows to seamlessly match how your business really operates."
    },
    {
      title: "Scalable",
      description: "Built to support large-scale operations and grow with your business as your needs evolve."
    },
    {
      title: "Product Development",
      description: "Harness our AI: craft precision prompts for seamless product development and generate vivid product visuals in seconds."
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Main Heading */}
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Free your team for higher impact work.
          </h2>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border border-border/50 hover:border-primary/20 transition-colors">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default InfoSection;