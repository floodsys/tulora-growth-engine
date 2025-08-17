import { Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const ProofStrip = () => {
  const testimonials = [
    {
      quote: "Tulora doubled our demo booking rate in the first month. Game changer for our sales team.",
      name: "Sarah Chen",
      role: "VP Sales",
      company: "TechFlow",
      initials: "SC"
    },
    {
      quote: "Finally, an AI that actually understands context and books qualified meetings.",
      name: "Marcus Rodriguez",
      role: "Sales Director",
      company: "ScaleUp",
      initials: "MR"
    },
    {
      quote: "Cut our scheduling time by 80% while improving prospect experience.",
      name: "Emily Davis",
      role: "Revenue Ops",
      company: "InnovateCo",
      initials: "ED"
    },
    {
      quote: "The follow-up automation alone pays for itself. Incredible ROI.",
      name: "David Kim",
      role: "Head of Growth",
      company: "BuildSpace",
      initials: "DK"
    }
  ];

  return (
    <section className="py-16 bg-background-secondary">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center items-center gap-2 mb-4">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
              ))}
            </div>
            <span className="text-sm text-muted-foreground ml-2">4.9/5 from 200+ teams</span>
          </div>
          <p className="text-lg text-muted-foreground">
            Join <span className="font-semibold text-brand">847 teams</span> who booked more meetings this month
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="card-glass p-6 hover:shadow-brand transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12 flex-shrink-0">
                  <AvatarFallback className="bg-brand text-brand-foreground font-semibold">
                    {testimonial.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm text-foreground mb-3 leading-relaxed">
                    "{testimonial.quote}"
                  </p>
                  <div className="text-xs">
                    <p className="font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-muted-foreground">
                      {testimonial.role} at {testimonial.company}
                    </p>
                  </div>
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