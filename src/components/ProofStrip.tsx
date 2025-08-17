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
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Trusted by leading companies
          </h2>
          <p className="text-lg text-gray-600">
            See what our customers say about their results
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-card p-6 rounded-lg border shadow-sm">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <blockquote className="text-sm text-gray-700 mb-4">
                "{testimonial.quote}"
              </blockquote>
              <div className="flex items-center">
                <Avatar className="h-8 w-8 mr-3">
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {testimonial.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-sm text-gray-900">{testimonial.name}</div>
                  <div className="text-xs text-gray-600">{testimonial.role}, {testimonial.company}</div>
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