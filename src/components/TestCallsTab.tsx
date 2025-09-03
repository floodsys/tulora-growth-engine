import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Phone, Monitor, Loader2, Copy } from "lucide-react";
import { callEF } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { BrowserCallModal } from "./BrowserCallModal";

const voiceAgents = [
  {
    slug: "paul",
    name: "Paul",
    category: "Real Estate",
    subtitle: "Lead Qualification · Buyer",
    phoneNumber: "+1 (289) 907-2070",
  },
  {
    slug: "laura",
    name: "Laura", 
    category: "Hospitality",
    subtitle: "Customer Service · Restaurant",
    phoneNumber: "+1 (289) 536-8131",
  },
  {
    slug: "jessica",
    name: "Jessica",
    category: "Healthcare",
    subtitle: "Healthcare Receptionist",
    phoneNumber: "+1 (863) 451-9425",
  },
];

export function TestCallsTab() {
  const [selectedAgent, setSelectedAgent] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("+1");
  const [isCallingPhone, setIsCallingPhone] = useState(false);
  const [isTryingBrowser, setIsTryingBrowser] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [traceId, setTraceId] = useState("");
  const [sessionData, setSessionData] = useState<{
    call_id?: string;
    client_secret?: string;
    access_token?: string;
  } | null>(null);
  const [isBrowserCallOpen, setIsBrowserCallOpen] = useState(false);
  
  const { toast } = useToast();

  const validatePhoneNumber = (phone: string) => {
    // E.164 validation: starts with +, followed by digits, 7-15 digits total
    const e164Regex = /^\+[1-9]\d{6,14}$/;
    return e164Regex.test(phone);
  };

  const getErrorMessage = (error: any) => {
    if (error.message?.includes("401")) {
      return "Auth missing — set VITE_SUPABASE_ANON_KEY.";
    }
    if (error.message?.includes("400")) {
      return "Check the fields (E.164 phone, agent).";
    }
    if (error.message?.includes("405")) {
      return "Use POST only.";
    }
    if (error.message?.includes("502")) {
      return "Upstream error — try again.";
    }
    return error.message || "Unknown error occurred";
  };

  const handleCallMe = async () => {
    if (!selectedAgent) {
      setStatusMessage("Please select an agent first.");
      return;
    }
    
    if (!validatePhoneNumber(phoneNumber)) {
      setStatusMessage("Please enter a valid E.164 phone number (e.g., +1234567890)");
      return;
    }

    setIsCallingPhone(true);
    setStatusMessage("");
    setTraceId("");
    setSessionData(null);

    try {
      const response = await callEF("retell-outbound", {
        agentSlug: selectedAgent,
        toNumber: phoneNumber,
      }) as any;
      
      setStatusMessage("Call queued—your phone should ring shortly.");
      
      // Log debugging info to console
      console.log("Call queued successfully:", {
        traceId: response?.traceId,
        call_id: response?.call_id,
        agentSlug: selectedAgent,
        toNumber: phoneNumber
      });
      
      if (response?.traceId) {
        setTraceId(response.traceId);
      }
      
      const agentName = voiceAgents.find(a => a.slug === selectedAgent)?.name || selectedAgent;
      toast({
        title: "Call queued",
        description: "Your phone should ring shortly",
      });
    } catch (error: any) {
      const errorMsg = getErrorMessage(error);
      setStatusMessage(`Error: ${errorMsg}`);
      
      if (error?.traceId) {
        setTraceId(error.traceId);
      }
    } finally {
      setIsCallingPhone(false);
    }
  };

  const handleTryInBrowser = async () => {
    if (!selectedAgent) {
      setStatusMessage("Please select an agent first.");
      return;
    }
    
    setIsTryingBrowser(true);
    setStatusMessage("");
    setTraceId("");
    setSessionData(null);

    try {
      const payload = await callEF("retell-webcall-create", {
        agentSlug: selectedAgent,
      }) as any;
      
      // Set session data and open browser call modal
      const newSessionData = {
        call_id: payload?.call_id,
        client_secret: payload?.client_secret,
        access_token: payload?.access_token,
      };
      
      setSessionData(newSessionData);
      
      if (payload?.traceId) {
        setTraceId(payload.traceId);
      }
      
      // Open the browser call modal
      setIsBrowserCallOpen(true);
      setStatusMessage("Browser call started!");
      
    } catch (error: any) {
      const errorMsg = getErrorMessage(error);
      setStatusMessage(`Error: ${errorMsg}`);
      
      if (error?.traceId) {
        setTraceId(error.traceId);
        console.error("Web call failed with traceId:", error.traceId);
      }
      
      toast({
        title: "Web call failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsTryingBrowser(false);
    }
  };

  const handleCopyPhone = async (phoneNumber: string) => {
    try {
      await navigator.clipboard.writeText(phoneNumber);
      toast({
        title: "Phone number copied",
        description: phoneNumber,
      });
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = phoneNumber;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy");
        toast({
          title: "Phone number copied",
          description: phoneNumber,
        });
      } catch (fallbackError) {
        toast({
          title: "Failed to copy",
          description: "Please copy the number manually",
          variant: "destructive",
        });
      }
      document.body.removeChild(textArea);
    }
  };

  const selectedAgentData = voiceAgents.find(agent => agent.slug === selectedAgent);
  const agentPhoneNumber = selectedAgentData?.phoneNumber || voiceAgents.find(agent => agent.slug === "jessica")?.phoneNumber;

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Test Voice Agent Calls</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select an agent and test the voice calling functionality
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Agent Selection */}
          <div className="space-y-2">
            <label htmlFor="agent-select" className="text-sm font-medium">
              Select Agent
            </label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an agent to test" />
              </SelectTrigger>
              <SelectContent>
                {voiceAgents.map((agent) => (
                  <SelectItem key={agent.slug} value={agent.slug} className="truncate">
                    <span className="truncate">{agent.name} - {agent.category}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Phone Input */}
          <div className="space-y-2">
            <label htmlFor="phone-input" className="text-sm font-medium">
              Phone Number (E.164 format)
            </label>
            <Input
              id="phone-input"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              className="font-mono"
              disabled={isCallingPhone || isTryingBrowser}
            />
            <p className="text-xs text-muted-foreground break-words">
              Enter phone number in E.164 format, starting with + and country code
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Button
                onClick={handleCallMe}
                disabled={isCallingPhone || isTryingBrowser || !phoneNumber || phoneNumber === "+1" || !selectedAgent}
                className="w-full"
                variant="default"
              >
                {isCallingPhone ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Calling...
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4 mr-2" />
                    Call Me
                  </>
                )}
              </Button>
            </div>
            
            <div className="space-y-1">
              <Button
                onClick={handleTryInBrowser}
                disabled={isTryingBrowser || isCallingPhone || !selectedAgent}
                className="w-full"
                variant="outline"
              >
                {isTryingBrowser ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Monitor className="w-4 h-4 mr-2" />
                    Try in Browser
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                This uses your microphone and plays audio in your browser. It won't call your phone.
              </p>
            </div>
          </div>

          {/* Call from Phone */}
          {selectedAgent && agentPhoneNumber && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">or call from phone</p>
              <div className="flex items-center justify-between bg-muted/30 p-3 rounded border">
                <a 
                  href={`tel:${agentPhoneNumber}`}
                  className="font-bold text-lg hover:underline"
                >
                  {agentPhoneNumber}
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyPhone(agentPhoneNumber)}
                  className="h-8 px-2"
                >
                  <Copy className="w-3 h-3" />
                  <span className="sr-only">Copy phone number</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Browser demo uses your mic — it won't call your phone. Carrier rates may apply.
              </p>
            </div>
          )}

          {/* Status Messages */}
          {statusMessage && (
            <div 
              className={`text-sm p-3 rounded break-words ${
                statusMessage.includes("Error") 
                  ? "bg-destructive/10 text-destructive border border-destructive/20" 
                  : "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
              }`}
              role="status"
              aria-live="polite"
            >
              {statusMessage}
            </div>
          )}

          {/* Trace ID */}
          {traceId && (
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded font-mono break-all">
              <strong>Trace ID:</strong> <span className="break-all">{traceId}</span>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Browser Call Modal */}
      <BrowserCallModal
        isOpen={isBrowserCallOpen}
        onClose={() => setIsBrowserCallOpen(false)}
        sessionData={sessionData}
        traceId={traceId}
        agentName={selectedAgentData?.name || "Agent"}
      />
    </div>
  );
}