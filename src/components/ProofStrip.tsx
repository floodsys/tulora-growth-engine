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
    <section className="py-16 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-card p-6 rounded-lg shadow-sm border">
              <div className="flex items-center mb-4">
                <Avatar className="h-10 w-10 mr-3">
                  <AvatarFallback>{testimonial.initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm">{testimonial.name}</p>
                  <p className="text-xs text-muted-foreground">{testimonial.role}, {testimonial.company}</p>
                </div>
              </div>
              <div className="flex mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground italic">"{testimonial.quote}"</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
export default ProofStrip;