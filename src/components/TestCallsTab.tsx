import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Phone, Monitor, Loader2 } from "lucide-react";
import { callEF } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const voiceAgents = [
  {
    slug: "paul",
    name: "Paul",
    category: "Real Estate",
    subtitle: "Lead Qualification · Buyer",
  },
  {
    slug: "laura",
    name: "Laura", 
    category: "Hospitality",
    subtitle: "Customer Service · Restaurant",
  },
  {
    slug: "jessica",
    name: "Jessica",
    category: "Healthcare",
    subtitle: "Healthcare Receptionist",
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
      if (response?.traceId) {
        setTraceId(response.traceId);
      }
      
      const agentName = voiceAgents.find(a => a.slug === selectedAgent)?.name || selectedAgent;
      toast({
        title: "Call queued",
        description: `Your phone should ring shortly for ${agentName}`,
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
      
      setStatusMessage("Web call session created!");
      setSessionData({
        call_id: payload?.call_id,
        client_secret: payload?.client_secret,
        access_token: payload?.access_token,
      });
      
      if (payload?.traceId) {
        setTraceId(payload.traceId);
      }
    } catch (error: any) {
      const errorMsg = getErrorMessage(error);
      setStatusMessage(`Error: ${errorMsg}`);
      
      if (error?.traceId) {
        setTraceId(error.traceId);
      }
    } finally {
      setIsTryingBrowser(false);
    }
  };

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
                  <SelectItem key={agent.slug} value={agent.slug}>
                    {agent.name} - {agent.category}
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
            <p className="text-xs text-muted-foreground">
              Enter phone number in E.164 format, starting with + and country code
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          {/* Status Messages */}
          {statusMessage && (
            <div 
              className={`text-sm p-3 rounded ${
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
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded font-mono">
              <strong>Trace ID:</strong> {traceId}
            </div>
          )}

          {/* Session Details for Browser Demo */}
          {sessionData && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Session Details</h4>
                <div 
                  className="text-sm space-y-2 bg-muted/50 p-4 rounded font-mono"
                  role="region"
                  aria-label="Web call session information"
                >
                  <div><strong>call_id:</strong> {sessionData.call_id}</div>
                  <div><strong>client_secret:</strong> {sessionData.client_secret}</div>
                  <div><strong>access_token:</strong> {sessionData.access_token}</div>
                </div>
                <p className="text-sm text-muted-foreground italic">
                  Browser audio coming soon.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}