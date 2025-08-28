import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { checkDevEnv } from "@/lib/api";
import { VoiceDemoCardSynthflow } from "./VoiceDemoCardSynthflow";
import { cn } from "@/lib/utils";

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

const filterChips = [
  { label: "All", value: "all" },
  { label: "#Real-Time Booking", value: "#Real-Time Booking" },
  { label: "#Receptionist", value: "#Receptionist" },
  { label: "#Lead Qualification", value: "#Lead Qualification" },
];

export function PlaygroundVoiceDemo() {
  const envCheck = checkDevEnv();
  const [selectedFilter, setSelectedFilter] = useState("all");

  // Filter agents based on selected chip
  const filteredAgents = selectedFilter === "all" 
    ? voiceAgents 
    : voiceAgents.filter(agent => agent.tags.includes(selectedFilter));

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

          {/* Use-case filter chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {filterChips.map((chip) => (
              <Button
                key={chip.value}
                variant="outline"
                size="sm"
                onClick={() => setSelectedFilter(chip.value)}
                className={cn(
                  "px-4 py-2 text-sm border border-border/50 hover:border-primary/50 transition-all duration-200",
                  selectedFilter === chip.value 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-background/50 hover:bg-primary/10"
                )}
              >
                {chip.label}
              </Button>
            ))}
          </div>

          {/* 3 cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {filteredAgents.map((agent) => (
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