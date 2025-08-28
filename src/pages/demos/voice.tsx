import { useState } from "react";
import { ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { VoiceDemoCard } from "@/components/VoiceDemoCard";

const voiceAgents = [
  {
    slug: "paul",
    name: "Paul",
    description: "Real estate buyer lead qualification and booking. Paul helps qualify potential buyers and schedules property viewings.",
    tags: ["#Real-Time Booking", "#Lead Qualification"],
  },
  {
    slug: "laura",
    name: "Laura",
    description: "Restaurant receptionist for Gourmet Table. Laura handles reservations and answers questions about our menu and availability.",
    tags: ["#Real-Time Booking", "#Receptionist"],
  },
  {
    slug: "jessica",
    name: "Jessica",
    description: "Healthcare receptionist for scheduling. Jessica helps patients book appointments and provides basic information about services.",
    tags: ["#Receptionist", "#Real-Time Booking"],
  },
];

export default function VoiceDemo() {
  const [systemStatus] = useState<"operational" | "warning" | "error">("operational");

  const getStatusConfig = () => {
    switch (systemStatus) {
      case "operational":
        return {
          icon: CheckCircle2,
          text: "All voice agents are online and ready to assist",
          className: "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20",
          iconClassName: "text-green-600 dark:text-green-400",
          textClassName: "text-green-800 dark:text-green-200",
        };
      case "warning":
        return {
          icon: AlertCircle,
          text: "Some agents may experience delays",
          className: "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20",
          iconClassName: "text-yellow-600 dark:text-yellow-400",
          textClassName: "text-yellow-800 dark:text-yellow-200",
        };
      case "error":
        return {
          icon: AlertCircle,
          text: "Voice services are currently unavailable",
          className: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20",
          iconClassName: "text-red-600 dark:text-red-400",
          textClassName: "text-red-800 dark:text-red-200",
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Voice Demo Gallery</h1>
                <p className="text-muted-foreground">
                  Try our AI voice agents with real phone calls or browser demos
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Status Area */}
        <Alert className={`mb-8 ${statusConfig.className}`}>
          <StatusIcon className={`h-4 w-4 ${statusConfig.iconClassName}`} />
          <AlertDescription className={statusConfig.textClassName}>
            {statusConfig.text}
          </AlertDescription>
        </Alert>

        {/* Instructions */}
        <div className="mb-8 p-6 bg-muted/50 rounded-lg border">
          <h2 className="text-lg font-semibold mb-3">How to test our voice agents:</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>Call Me:</strong> Enter your phone number and we'll have the agent call you directly.
            </p>
            <p>
              <strong>Try in Browser:</strong> Test the agent in your web browser using your microphone.
            </p>
            <p className="text-xs">
              Note: Phone numbers must be in E.164 format (e.g., +1234567890). Browser demos require microphone access.
            </p>
          </div>
        </div>

        {/* Agent Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {voiceAgents.map((agent) => (
            <VoiceDemoCard
              key={agent.slug}
              slug={agent.slug}
              name={agent.name}
              description={agent.description}
              tags={agent.tags}
            />
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center">
          <div className="inline-block p-4 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground">
              These are live AI agents powered by advanced language models.
              <br />
              Conversations may be recorded for quality and training purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}