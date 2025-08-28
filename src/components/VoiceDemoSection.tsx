import { VoiceDemoCard } from "@/components/VoiceDemoCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { checkDevEnv } from "@/lib/api";

const voiceAgents = [
  {
    slug: "paul",
    name: "Paul",
    description: "Real Estate Lead Qualification",
    tags: ["#Real-Time Booking", "#Lead Qualification"],
  },
  {
    slug: "laura",
    name: "Laura", 
    description: "Restaurant Receptionist",
    tags: ["#Real-Time Booking", "#Receptionist"],
  },
  {
    slug: "jessica",
    name: "Jessica",
    description: "Healthcare Receptionist", 
    tags: ["#Receptionist", "#Real-Time Booking"],
  },
];

export function VoiceDemoSection() {
  const envCheck = checkDevEnv();

  return (
    <section id="voice-demo" className="py-24 bg-gradient-to-br from-background to-secondary/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">
            Try our Voice Agents (Live Demo)
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-4">
            Experience the power of conversational AI. Choose an agent below to either receive a phone call 
            or try our browser-based demo.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Use a real mobile number in E.164. Calls may be recorded for testing.
          </p>
          
          {/* Dev warning banner */}
          {!envCheck.hasAnonKey && envCheck.warning && (
            <Alert className="max-w-2xl mx-auto mb-8">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{envCheck.warning}</AlertDescription>
            </Alert>
          )}
          
          <div className="bg-muted/50 rounded-lg p-4 max-w-2xl mx-auto">
            <p className="text-sm text-muted-foreground">
              <strong>Instructions:</strong> Enter your phone number in E.164 format (e.g., +1234567890) 
              and click "Call Me" to receive a phone call, or click "Try in Browser" for an immediate web-based demo.
            </p>
          </div>
        </div>

        {/* Agent Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
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

        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            These AI agents are powered by advanced conversational AI technology and can handle 
            complex interactions in real-time.
          </p>
        </div>
      </div>
    </section>
  );
}