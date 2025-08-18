import { Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
const ProofStrip = () => {
  const testimonials = [{
    quote: "Tulora doubled our demo booking rate in the first month. Game changer for our sales team.",
    name: "Sarah Chen",
    role: "VP Sales",
    company: "TechFlow",
    initials: "SC"
  }, {
    quote: "Finally, an AI that actually understands context and books qualified meetings.",
    name: "Marcus Rodriguez",
    role: "Sales Director",
    company: "ScaleUp",
    initials: "MR"
  }, {
    quote: "Cut our scheduling time by 80% while improving prospect experience.",
    name: "Emily Davis",
    role: "Revenue Ops",
    company: "InnovateCo",
    initials: "ED"
  }, {
    quote: "The follow-up automation alone pays for itself. Incredible ROI.",
    name: "David Kim",
    role: "Head of Growth",
    company: "BuildSpace",
    initials: "DK"
  }];

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Trusted by Sales Leaders</h2>
          <p className="text-muted-foreground">See what our customers are saying</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-card p-6 rounded-lg shadow-sm border">
              <div className="flex items-center mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground mb-4">"{testimonial.quote}"</p>
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs">{testimonial.initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{testimonial.name}</p>
                  <p className="text-xs text-muted-foreground">{testimonial.role}, {testimonial.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
export default ProofStrip;