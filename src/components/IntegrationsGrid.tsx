import { Calendar, Phone, MessageSquare, BarChart3, Users, Zap } from "lucide-react";

const IntegrationsGrid = () => {
  const integrations = [
    {
      name: "Cal.com",
      icon: <Calendar className="h-8 w-8 text-brand" />,
      description: "Seamless calendar integration and booking"
    },
    {
      name: "Google Calendar",
      icon: <Calendar className="h-8 w-8 text-blue-500" />,
      description: "Sync availability and auto-book meetings"
    },
    {
      name: "Microsoft Calendar",
      icon: <Calendar className="h-8 w-8 text-blue-600" />,
      description: "Outlook integration for enterprise teams"
    },
    {
      name: "Twilio",
      icon: <Phone className="h-8 w-8 text-red-500" />,
      description: "Voice calls and SMS notifications"
    },
    {
      name: "Vapi",
      icon: <Phone className="h-8 w-8 text-purple-500" />,
      description: "AI voice agents for follow-ups"
    },
    {
      name: "Retell",
      icon: <Phone className="h-8 w-8 text-green-500" />,
      description: "Real-time voice AI conversations"
    },
    {
      name: "Slack",
      icon: <MessageSquare className="h-8 w-8 text-purple-600" />,
      description: "Team notifications and updates"
    },
    {
      name: "HubSpot",
      icon: <BarChart3 className="h-8 w-8 text-orange-500" />,
      description: "CRM sync and lead management"
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Works with your existing stack
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tulora integrates seamlessly with the tools you already use, no workflow disruption required.
          </p>
        </div>

        {/* Integrations Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {integrations.map((integration, index) => (
            <div
              key={index}
              className="card-glass p-6 text-center hover:shadow-brand transition-all duration-300 group cursor-pointer"
            >
              <div className="mb-4">
                <div className="w-16 h-16 bg-background-secondary rounded-xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                  {integration.icon}
                </div>
              </div>
              <h3 className="font-semibold text-foreground mb-2">{integration.name}</h3>
              <p className="text-sm text-muted-foreground">{integration.description}</p>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            Don't see your tool? We're constantly adding new integrations.
          </p>
          <a
            href="/integrations"
            className="text-brand hover:text-brand-dark font-semibold transition-colors duration-200"
          >
            View all integrations →
          </a>
        </div>
      </div>
    </section>
  );
};

export default IntegrationsGrid;