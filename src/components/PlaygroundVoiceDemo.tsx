import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertCircle } from "lucide-react";
import { checkDevEnv } from "@/lib/api";
import { VoiceDemoCardSynthflow } from "./VoiceDemoCardSynthflow";
import { TestCallsTab } from "./TestCallsTab";
import { AgentFlowView } from "./AgentFlowView";
import { KnowledgeBaseView } from "./KnowledgeBaseView";
import { cn } from "@/lib/utils";

const voiceAgents = [
  {
    slug: "paul",
    name: "Paul",
    category: "Real Estate",
    subtitle: "Lead Qualification · Buyer",
    description: "Meet Paul, an AI assistant designed for real estate lead qualification. Paul's primary objective is to identify the preference...",
    tags: ["#Real-Time Booking", "#Lead Qualification"],
  },
  {
    slug: "laura",
    name: "Laura", 
    category: "Hospitality",
    subtitle: "Customer Service · Restaurant",
    description: "Meet Laura, an AI assistant for Gourmet Table, a fine dining restaurant. Her primary role is to assist callers in scheduling...",
    tags: ["#Real-Time Booking", "#Front-of-house"],
  },
  {
    slug: "jessica",
    name: "Jessica",
    category: "Healthcare",
    subtitle: "Healthcare Receptionist",
    description: "Meet Jessica, an AI assistant for your Healthcare company, dedicated to streamlining appointment scheduling and improving...", 
    tags: ["#Receptionist", "#Real-Time Booking"],
  },
];

const tabs = [
  { label: "Use Case", value: "use-case" },
  { label: "Flow Designer", value: "flow-designer" },
  { label: "Knowledge Base", value: "knowledge-base" },
  { label: "Actions", value: "actions" },
  { label: "Test Calls", value: "test-calls" },
];

export function PlaygroundVoiceDemo() {
  const envCheck = checkDevEnv();
  const [activeTab, setActiveTab] = useState("use-case");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const handleAgentSelect = (slug: string) => {
    setSelectedAgent(slug);
    setActiveTab("flow-designer");
  };

  const handleBackToUseCases = () => {
    setSelectedAgent(null);
    setActiveTab("use-case");
  };

  return (
    <section id="voice-demo">
      <div className="playground-wrapper is-test">
        <div className="container mx-auto px-4 py-8">
          {/* Heading */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">
              Hear AI Voice Agents in Action
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              Choose a call type to see how Tulora AI agents handle real conversations.
            </p>
            
            {/* Dev warning banner */}
            {!envCheck.hasAnonKey && envCheck.warning && (
              <Alert className="max-w-2xl mx-auto mb-8">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{envCheck.warning}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-4xl mx-auto mb-8">
            <TabsList className="grid w-full grid-cols-5">
              {tabs.map((tab) => (
                <TabsTrigger 
                  key={tab.value} 
                  value={tab.value}
                  className="text-sm"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="use-case" className="mt-8">
              {/* 3 cards grid - smaller and side by side */}
              <div 
                className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto"
              >
                {voiceAgents.map((agent) => (
                  <VoiceDemoCardSynthflow
                    key={agent.slug}
                    slug={agent.slug}
                    name={agent.name}
                    description={agent.description}
                    tags={agent.tags}
                    category={agent.category}
                    subtitle={agent.subtitle}
                    showActions={false}
                    onCardClick={handleAgentSelect}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="flow-designer" className="mt-8">
              {selectedAgent ? (
                (() => {
                  const agent = voiceAgents.find(a => a.slug === selectedAgent);
                  return agent ? (
                    <AgentFlowView agent={agent} onBack={handleBackToUseCases} />
                  ) : (
                    <p className="text-muted-foreground text-center py-12">Agent not found</p>
                  );
                })()
              ) : (
                <p className="text-muted-foreground text-center py-12">Select a use case to view its flow designer</p>
              )}
            </TabsContent>

            <TabsContent value="knowledge-base" className="mt-8">
              {selectedAgent ? (
                (() => {
                  const agent = voiceAgents.find(a => a.slug === selectedAgent);
                  return agent ? (
                    <KnowledgeBaseView agent={agent} />
                  ) : (
                    <p className="text-muted-foreground text-center py-12">Agent not found</p>
                  );
                })()
              ) : (
                <p className="text-muted-foreground text-center py-12">Select a use case to view its knowledge base</p>
              )}
            </TabsContent>

            <TabsContent value="actions" className="mt-8 text-center py-12">
              <p className="text-muted-foreground">Actions coming soon...</p>
            </TabsContent>

            <TabsContent value="test-calls" className="mt-8">
              <TestCallsTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  );
}