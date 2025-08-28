import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { checkDevEnv } from "@/lib/api";
import { VoiceDemoCardSynthflow } from "./VoiceDemoCardSynthflow";

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

export function PlaygroundVoiceDemo() {
  const envCheck = checkDevEnv();

  return (
    <section id="voice-demo">
      <div className="playground-wrapper is-test">
        <div className="container mx-auto px-4 py-16">
          {/* Heading */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">
              Try our Voice Agents (Live Demo)
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Use a real mobile number in E.164. Calls may be recorded for testing.
            </p>
            
            {/* Dev warning banner */}
            {!envCheck.hasAnonKey && envCheck.warning && (
              <Alert className="max-w-2xl mx-auto mb-8">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{envCheck.warning}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Use-case chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full">
              Real Estate
            </span>
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full">
              Restaurant
            </span>
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full">
              Healthcare
            </span>
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full">
              Live Demo
            </span>
          </div>

          {/* 3 cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {voiceAgents.map((agent) => (
              <VoiceDemoCardSynthflow
                key={agent.slug}
                slug={agent.slug}
                name={agent.name}
                description={agent.description}
                tags={agent.tags}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}