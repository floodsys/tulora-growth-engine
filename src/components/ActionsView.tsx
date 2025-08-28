import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, Phone, Menu, Plus } from "lucide-react";

interface ActionsViewProps {
  agent: {
    slug: string;
    name: string;
    category: string;
    subtitle: string;
    description: string;
    tags: string[];
  };
}

export const ActionsView = ({ agent }: ActionsViewProps) => {
  const actions = [
    {
      id: "real-time-booking",
      name: "Real-Time Booking",
      description: "Seamlessly schedule appointments and meetings directly during the call",
      icon: Calendar,
      enabled: true,
      color: "bg-green-50 border-green-200",
      iconColor: "text-green-600"
    },
    {
      id: "warm-transfer",
      name: "Warm Transfer",
      description: "Transfer calls to human agents with full context and conversation history",
      icon: Phone,
      enabled: true,
      color: "bg-blue-50 border-blue-200", 
      iconColor: "text-blue-600"
    },
    {
      id: "ivr",
      name: "IVR",
      description: "Interactive voice response system for call routing and self-service options",
      icon: Menu,
      enabled: true,
      color: "bg-purple-50 border-purple-200",
      iconColor: "text-purple-600"
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-2xl font-bold mb-2">Actions for {agent.name}</h3>
        <p className="text-muted-foreground">
          Configure and manage the actions your AI agent can perform during conversations
        </p>
      </div>

      {/* Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {actions.map((action) => {
          const IconComponent = action.icon;
          return (
            <Card 
              key={action.id} 
              className={`p-6 hover:shadow-md transition-shadow cursor-pointer ${action.color}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2 rounded-lg bg-white/50`}>
                  <IconComponent className={`w-6 h-6 ${action.iconColor}`} />
                </div>
                {action.enabled && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                    Enabled
                  </Badge>
                )}
              </div>
              
              <h4 className="font-semibold text-lg mb-2">{action.name}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {action.description}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Create Custom Action */}
      <Card className="p-6 border-dashed border-2 border-muted-foreground/20 hover:border-muted-foreground/40 transition-colors cursor-pointer">
        <div className="text-center">
          <div className="p-3 rounded-lg bg-muted/50 w-fit mx-auto mb-4">
            <Plus className="w-6 h-6 text-muted-foreground" />
          </div>
          <h4 className="font-semibold text-lg mb-2">Create Custom Action</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Build your own custom actions to extend your agent's capabilities
          </p>
          <Button variant="outline" size="sm">
            Get Started
          </Button>
        </div>
      </Card>

      {/* Footer Note */}
      <div className="text-center text-sm text-muted-foreground">
        Actions are automatically triggered based on conversation context and user intent
      </div>

      {/* Test Call Button */}
      <div className="text-center pt-4">
        <Button size="lg" className="px-8">
          Try it in a test call
        </Button>
      </div>
    </div>
  );
};