import { ArrowRight, MessageSquare, Database, Github, Palette, Zap, Building, Cloud, CreditCard, MessageCircle, Search, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
const IntegrationsGrid = () => {
  const integrationLogos = [
  // Top row
  {
    name: "Slack",
    position: "top-[10%] left-[15%]",
    color: "text-purple-500",
    Icon: MessageSquare
  }, {
    name: "Notion",
    position: "top-[5%] left-[45%]",
    color: "text-gray-800",
    Icon: Database
  }, {
    name: "GitHub",
    position: "top-[15%] right-[20%]",
    color: "text-gray-900",
    Icon: Github
  },
  // Middle row  
  {
    name: "Figma",
    position: "top-[35%] left-[8%]",
    color: "text-purple-600",
    Icon: Palette
  }, {
    name: "Zapier",
    position: "top-[40%] left-[35%]",
    color: "text-orange-500",
    Icon: Zap
  }, {
    name: "HubSpot",
    position: "top-[30%] right-[15%]",
    color: "text-orange-600",
    Icon: Building
  }, {
    name: "Salesforce",
    position: "top-[45%] right-[40%]",
    color: "text-blue-500",
    Icon: Cloud
  },
  // Bottom row
  {
    name: "Stripe",
    position: "bottom-[25%] left-[20%]",
    color: "text-indigo-600",
    Icon: CreditCard
  }, {
    name: "Discord",
    position: "bottom-[30%] left-[50%]",
    color: "text-indigo-500",
    Icon: MessageCircle
  }, {
    name: "Google",
    position: "bottom-[20%] right-[25%]",
    color: "text-red-500",
    Icon: Search
  }, {
    name: "Twilio",
    position: "bottom-[35%] right-[10%]",
    color: "text-red-600",
    Icon: Phone
  }];
  return <section className="py-20 bg-background relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Floating Integration Icons */}
        <div className="absolute inset-0 pointer-events-none">
          {integrationLogos.map((logo, index) => <div key={index} className={`absolute ${logo.position} w-12 h-12 bg-background-secondary rounded-xl flex items-center justify-center shadow-sm border border-border animate-float opacity-60 hover:opacity-100 transition-opacity duration-300`} style={{
          animationDelay: `${index * 0.5}s`,
          animationDuration: `${3 + index % 3}s`
        }}>
              <logo.Icon className={`w-6 h-6 ${logo.color}`} />
            </div>)}
        </div>

        {/* Main Content */}
        <div className="text-center relative z-10 max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-brand/10 text-brand px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-brand rounded-full"></span>
            Explore our dynamic integrations.
          </div>

          {/* Main Heading */}
          <h2 className="text-4xl font-bold text-foreground mb-6 leading-tight lg:text-4xl">
            Seamless Integrations 
            <span className="block">Await You</span>
          </h2>

          {/* Description */}
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed text-2xl">
            Connect with our powerful ecosystem and enhance your workflow through robust integrations that streamline processes and save time.
          </p>

          {/* CTA Button */}
          
        </div>

        {/* Gradient Overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/20 pointer-events-none"></div>
      </div>
    </section>;
};
export default IntegrationsGrid;