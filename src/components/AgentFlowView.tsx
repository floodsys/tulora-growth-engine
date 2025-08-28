import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ArrowLeft, Eye, FileText } from "lucide-react";

interface AgentFlowViewProps {
  agent: {
    slug: string;
    name: string;
    category: string;
    subtitle: string;
    description: string;
    tags: string[];
  };
  onBack: () => void;
}

const agentFlows = {
  paul: {
    steps: [
      { id: "global", title: "Global Settings", description: "Who You Are You're Paul, the calm, helpful, and easygoing voice of a real estate team. Your go..." },
      { id: "greeting", title: "Greeting Message", description: "Hey there! This is Paul from [Real Estate Company]—how're you doing today?" },
      { id: "disclaimer", title: "Greeting and Disclaimer", description: "After the custom greeting, [hey there! This is Paul from [Real Estate Company]—how're you...]" },
      { id: "discovery", title: "Discovery Flow", description: "Ask these questions conversationally—adapt to the caller's pace: 1. 'What city or neighborho..." },
      { id: "qualification", title: "Qualification Logic", description: "Press the lead if: They give clear or realistic location and budget. They are either pre-..." },
      { id: "result", title: "Disqualified/Qualified", description: "*If the user is qualified:* Say: 'Sounds like we could definitely help with that. I'd like to get y..." }
    ],
    prompt: `You are Paul, a calm and helpful AI voice assistant for a real estate company. Your primary goal is to qualify leads by understanding their property needs, budget, and timeline.

Key behaviors:
- Be conversational and friendly
- Ask discovery questions naturally
- Qualify based on realistic budget and location
- Schedule appointments for qualified leads
- Politely disqualify unrealistic inquiries

Discovery Flow:
1. What city or neighborhood interests you?
2. What's your budget range?
3. Are you looking to buy or rent?
4. When are you hoping to move?

Qualification Criteria:
- Clear, realistic location
- Reasonable budget for the area
- Genuine interest in buying/renting
- Reasonable timeline`
  },
  laura: {
    steps: [
      { id: "global", title: "Global Settings", description: "Who You Are You're Laura, the friendly and professional voice of Gourmet Table restaurant..." },
      { id: "greeting", title: "Greeting Message", description: "Hello! Thank you for calling Gourmet Table. This is Laura, how can I help you today?" },
      { id: "disclaimer", title: "Greeting and Disclaimer", description: "After the custom greeting, provide restaurant information and availability..." },
      { id: "discovery", title: "Booking Flow", description: "Ask these questions to complete the reservation: 1. 'What date would you like to dine with us?'..." },
      { id: "qualification", title: "Availability Check", description: "Check availability based on: Date and time requested, party size, special requirements..." },
      { id: "result", title: "Confirmed/Waitlist", description: "*If table available:* Confirm the reservation details and provide confirmation number..." }
    ],
    prompt: `You are Laura, a friendly and professional AI assistant for Gourmet Table, a fine dining restaurant. Your role is to assist with reservations and provide excellent customer service.

Key behaviors:
- Maintain professional yet warm tone
- Efficiently handle reservation requests
- Provide restaurant information
- Handle special requests gracefully
- Confirm all booking details

Booking Flow:
1. What date would you like to dine?
2. What time preference?
3. How many guests?
4. Any special occasions or dietary requirements?

Service Standards:
- Always confirm reservation details
- Provide confirmation number
- Offer alternative times if unavailable
- Handle special requests professionally`
  },
  jessica: {
    steps: [
      { id: "global", title: "Global Settings", description: "Who You Are You're Jessica, the caring and efficient voice of a healthcare practice..." },
      { id: "greeting", title: "Greeting Message", description: "Hello, thank you for calling [Healthcare Practice]. This is Jessica, how may I assist you?" },
      { id: "disclaimer", title: "Greeting and Disclaimer", description: "After the custom greeting, provide practice information and appointment options..." },
      { id: "discovery", title: "Appointment Flow", description: "Ask these questions to schedule: 1. 'What type of appointment do you need?'..." },
      { id: "qualification", title: "Scheduling Logic", description: "Schedule based on: Appointment type, provider availability, urgency level..." },
      { id: "result", title: "Scheduled/Referred", description: "*If appointment scheduled:* Confirm appointment details and provide preparation instructions..." }
    ],
    prompt: `You are Jessica, a caring and efficient AI receptionist for a healthcare practice. Your role is to help patients schedule appointments and provide practice information.

Key behaviors:
- Maintain professional and caring tone
- Handle health information sensitively
- Efficiently schedule appointments
- Provide clear instructions
- Know when to escalate to human staff

Appointment Flow:
1. What type of appointment do you need?
2. Which provider would you prefer?
3. What dates and times work for you?
4. Is this urgent or routine?

Healthcare Standards:
- Always confirm appointment details
- Provide preparation instructions
- Handle urgent matters appropriately
- Maintain patient confidentiality`
  }
};

export function AgentFlowView({ agent, onBack }: AgentFlowViewProps) {
  const [viewMode, setViewMode] = useState<"flow" | "prompt">("flow");
  const agentFlow = agentFlows[agent.slug as keyof typeof agentFlows];

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-4 hover:bg-muted"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Use Cases
        </Button>
        
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Eye className="w-4 h-4" />
            FLOW PREVIEW
          </div>
          <h1 className="text-xl font-semibold">{agent.subtitle}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            This agent follows a predefined logic flow to simulate real conversations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Mode Selection */}
        <div className="lg:col-span-1">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">SELECT A MODE</h3>
            
            <Card 
              className={`cursor-pointer transition-all duration-200 ${
                viewMode === "flow" 
                  ? "border-primary bg-primary/5 shadow-sm" 
                  : "border-border hover:bg-muted/50"
              }`}
              onClick={() => setViewMode("flow")}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    viewMode === "flow" ? "bg-primary" : "bg-blue-500"
                  }`}>
                    <Eye className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">Flow View</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      View the logic of this use case visually.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all duration-200 ${
                viewMode === "prompt" 
                  ? "border-primary bg-primary/5 shadow-sm" 
                  : "border-border hover:bg-muted/50"
              }`}
              onClick={() => setViewMode("prompt")}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    viewMode === "prompt" ? "bg-primary" : "bg-green-500"
                  }`}>
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">Prompt View</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      View this use case's logic as a natural language prompt.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="lg:col-span-3">
          {viewMode === "flow" ? (
            <div className="space-y-4">
              {agentFlow.steps.map((step, index) => (
                <Card key={step.id} className="border border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium">{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 bg-primary rounded-full"></span>
                          {step.title}
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <div className="mt-6 text-right">
                <Button variant="outline" className="text-sm">
                  Explore the agent's knowledge base →
                </Button>
              </div>
            </div>
          ) : (
            <Card className="border border-border/50">
              <CardContent className="p-6">
                <h3 className="font-medium mb-4">Agent Prompt</h3>
                <div className="bg-muted/30 rounded-lg p-4">
                  <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                    {agentFlow.prompt}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}