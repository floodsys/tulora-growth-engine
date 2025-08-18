import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useRef } from 'react';
import Typed from 'typed.js';
import featuresImage from '@/assets/features.svg?url';
import { Layers, Target, Star, Settings, TrendingUp, Lightbulb } from 'lucide-react';
const InfoSection = () => {
  const el = useRef(null);
  useEffect(() => {
    const typed = new Typed(el.current, {
      strings: ["Build. 🚀", "Automate. 🤖", "Scale. 📈"],
      typeSpeed: 20,
      backSpeed: 20,
      loop: true
    });
    return () => {
      typed.destroy();
    };
  }, []);
  const features = [{
    title: "All-in-one multi-agent platform",
    description: "A flexible, multi-agent platform built for any use case, across any industry.",
    icon: Layers
  }, {
    title: "Built for business-critical tasks",
    description: "Built for high-stakes tasks that drive real results, — intelligent automation, not just a bot.",
    icon: Target
  }, {
    title: "Delivers human-quality work",
    description: "Powerful, intelligent automation that matches the quality and precision of top human talent.",
    icon: Star
  }, {
    title: "Works the way you do",
    description: "Fully customizable workflows to seamlessly match how your business really operates.",
    icon: Settings
  }, {
    title: "Scalable",
    description: "Built to support large-scale operations and grow with your business as your needs evolve.",
    icon: TrendingUp
  }, {
    title: "Product Development",
    description: "Harness our AI: craft precision prompts for seamless product development and generate vivid product visuals in seconds.",
    icon: Lightbulb
  }];
  return <section className="py-8 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Features Image */}
        <div className="text-center mb-16">
          <img src="https://71bed9839f6b63de0d12cd02f4fd4947.cdn.bubble.io/f1754097164349x913319392506058100/features.svg" alt="AI automation features and data flows illustration" className="max-w-full h-auto mx-auto" />
        </div>

        {/* Typewriter Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-4">
            <span ref={el} className="text-4xl"></span>
          </h2>
        </div>

        {/* Main Heading */}
        <div className="text-center mb-16">
          <h3 className="text-4xl text-foreground mb-6 font-bold lg:text-2xl">
            Free your team for higher impact work.
          </h3>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
          const IconComponent = feature.icon;
          return <Card key={index} className="border border-border/50 hover:border-primary/20 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="mb-4">
                    <div className="w-12 h-12 mb-4 rounded-lg bg-gradient-to-br from-[#6056FF] to-[#FE7587] flex items-center justify-center mx-auto">
                      <IconComponent className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>;
        })}
        </div>
      </div>
    </section>;
};
export default InfoSection;