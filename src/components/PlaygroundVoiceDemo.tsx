import { VoiceDemoCardSynthflow } from "@/components/VoiceDemoCardSynthflow";
import { DiagnosticsBar } from "@/components/ui/DiagnosticsBar";

const filterBookingTags = (tags: string[]) => {
  const isDemoBookingEnabled = import.meta.env.VITE_DEMO_BOOKING_ENABLED === "true";
  if (isDemoBookingEnabled) return tags;
  return tags.filter(tag => !tag.toLowerCase().includes('booking'));
};

export function PlaygroundVoiceDemo() {
  // Keep only the 3 core demo agents: Paul, Laura, Jessica
  const agents = [
    {
      slug: "paul-realtor",
      name: "Paul",
      description: "Real estate agent who helps with property inquiries and scheduling viewings",
      tags: filterBookingTags(["#Real Estate", "#Lead Qualification"]),
    },
    {
      slug: "laura-restaurant", 
      name: "Laura",
      description: "Restaurant host who takes reservations and answers menu questions",
      tags: filterBookingTags(["#Restaurant", "#Front-of-house"]),
    },
    {
      slug: "jessica-healthcare",
      name: "Jessica",
      description: "Healthcare receptionist who schedules appointments and provides basic information",
      tags: filterBookingTags(["#Healthcare", "#Receptionist"]),
    },
  ];

  return (
    <div className="relative bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Dev diagnostics banner */}
      <DiagnosticsBar />
      
      <div className="playground-wrapper is-test">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Try Our AI Voice Agents
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Experience real-time conversations with our specialized AI agents. 
              Call directly or try in your browser.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {agents.map((agent) => (
              <VoiceDemoCardSynthflow
                key={agent.slug}
                slug={agent.slug}
                name={agent.name}
                description={agent.description}
                tags={agent.tags}
                showActions={true}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
