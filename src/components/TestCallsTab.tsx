import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Phone, Monitor, Loader2, Copy, ChevronDown, Clock } from "lucide-react";
import { callEF } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { BrowserCallModal } from "./BrowserCallModal";
import { 
  JESSICA_PHONE, 
  PAUL_PHONE, 
  LAURA_PHONE,
  JESSICA_CALL,
  JESSICA_WEB,
  PAUL_CALL,
  PAUL_WEB,
  LAURA_CALL,
  LAURA_WEB
} from "@/config/publicConfig";

const voiceAgents = [{
  slug: "paul",
  name: "Paul",
  category: "Real Estate",
  subtitle: "Lead Qualification · Buyer",
  phoneNumber: PAUL_PHONE
}, {
  slug: "laura",
  name: "Laura",
  category: "Hospitality",
  subtitle: "Customer Service · Restaurant",
  phoneNumber: LAURA_PHONE
}, {
  slug: "jessica",
  name: "Jessica",
  category: "Healthcare",
  subtitle: "Healthcare Receptionist",
  phoneNumber: JESSICA_PHONE
}];
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
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [lastErrorStatus, setLastErrorStatus] = useState<number | null>(null);
  const [lastPayload, setLastPayload] = useState<any>(null);
  const {
    toast
  } = useToast();
  const validatePhoneNumber = (phone: string) => {
    // E.164 validation: starts with +, followed by digits, 7-15 digits total
    const e164Regex = /^\+[1-9]\d{6,14}$/;
    return e164Regex.test(phone);
  };
  const getErrorMessage = (error: any) => {
    if (error.message?.includes("401")) {
      return "Auth missing — check Supabase configuration.";
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
    
    // Enhanced phone validation with better error messaging
    if (!validatePhoneNumber(phoneNumber)) {
      const errorMsg = "Please enter a valid phone number in E.164 format (e.g., +1234567890)";
      setStatusMessage(errorMsg);
      toast({
        title: "Invalid phone number",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }
    
    setIsCallingPhone(true);
    setStatusMessage("");
    setTraceId("");
    setSessionData(null);
    setLastErrorStatus(null);
    
    const payload = { agentSlug: selectedAgent, toNumber: phoneNumber };
    setLastPayload({ action: "retell-outbound", request: payload });
    
    try {
      const response = (await callEF("retell-outbound", payload)) as any;
      setLastPayload({ action: "retell-outbound", request: payload, response });
      
      // Success feedback
      setStatusMessage("Call queued — your phone should ring shortly.");
      
      // Console logging for debugging
      console.log("Call queued successfully:", {
        traceId: response?.traceId,
        call_id: response?.call_id,
        agentSlug: selectedAgent,
        toNumber: phoneNumber,
        response: response
      });
      
      // Extract traceId for display
      if (response?.traceId) {
        setTraceId(response.traceId);
      }
      
      // Success toast
      toast({
        title: "Call queued",
        description: "Your phone should ring shortly",
      });
      
    } catch (error: any) {
      // Enhanced error handling with specific mappings
      let errorTitle = "Call failed";
      let errorDescription = "Unknown error occurred";
      
      // Extract error details
      const status = error.status || null;
      const traceId = error.traceId || null;
      
      // Map specific error cases
      if (status === 404) {
        errorTitle = "Agent not configured";
        errorDescription = "Agent not configured yet.";
      } else if (status === 401) {
        errorTitle = "Authentication invalid";
        errorDescription = "Auth invalid.";
      } else if (status === 403 || status === 409) {
        errorTitle = "Number not authorized";
        errorDescription = "From-number not authorized.";
      } else if (error.message?.includes("401")) {
        errorTitle = "Authentication invalid";
        errorDescription = "Auth invalid.";
      } else if (error.message?.includes("404")) {
        errorTitle = "Agent not configured";
        errorDescription = "Agent not configured yet.";
      } else if (error.message?.includes("403") || error.message?.includes("409")) {
        errorTitle = "Number not authorized";
        errorDescription = "From-number not authorized.";
      } else {
        // Generic error message
        errorDescription = error.message || "Call failed.";
      }
      
      setStatusMessage(`Error: ${errorDescription}`);
      
      // Console logging for debugging (always include traceId if available)
      console.error("Call failed:", {
        error: error.message,
        status: status,
        traceId: traceId,
        agentSlug: selectedAgent,
        toNumber: phoneNumber,
        originalPayload: error.originalPayload
      });
      
      // Set traceId for display if available
      if (traceId) {
        setTraceId(traceId);
      }
      
      // Error toast
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
      
      // Extract status code for debugging display
      if (status) {
        setLastErrorStatus(status);
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
    setLastErrorStatus(null);
    
    const payload = { agentSlug: selectedAgent };
    setLastPayload({ action: "retell-webcall-create", request: payload });
    
    try {
      const response = (await callEF("retell-webcall-create", payload)) as any;
      setLastPayload({ action: "retell-webcall-create", request: payload, response });

      // Set session data and open browser call modal
      const newSessionData = {
        call_id: response?.call_id,
        client_secret: response?.client_secret,
        access_token: response?.access_token
      };
      setSessionData(newSessionData);
      if (response?.traceId) {
        setTraceId(response.traceId);
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
      // Extract status code from error message
      const statusMatch = error.message?.match(/(\d{3})/);
      if (statusMatch) {
        setLastErrorStatus(parseInt(statusMatch[1]));
      }
      toast({
        title: "Web call failed",
        description: errorMsg,
        variant: "destructive"
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
        description: phoneNumber
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
          description: phoneNumber
        });
      } catch (fallbackError) {
        toast({
          title: "Failed to copy",
          description: "Please copy the number manually",
          variant: "destructive"
        });
      }
      document.body.removeChild(textArea);
    }
  };
  
  const handleCopyLogs = async () => {
    try {
      const logs = JSON.stringify(lastPayload, null, 2);
      await navigator.clipboard.writeText(logs);
      toast({
        title: "Logs copied",
        description: "Latest payload copied to clipboard"
      });
    } catch (error) {
      toast({
        title: "Failed to copy logs",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };
  
  const maskCallId = (callId: string | undefined) => {
    if (!callId) return "—";
    if (callId.length <= 8) return callId;
    return `${callId.slice(0, 4)}...${callId.slice(-4)}`;
  };
  
  const selectedAgentData = voiceAgents.find(agent => agent.slug === selectedAgent);
  const agentPhoneNumber = selectedAgentData?.phoneNumber || voiceAgents.find(agent => agent.slug === "jessica")?.phoneNumber;
  
  // Get feature flags for selected agent from publicConfig
  const getAgentFlags = (slug: string) => {
    switch (slug) {
      case 'jessica':
        return { callMe: JESSICA_CALL, tryInBrowser: JESSICA_WEB };
      case 'paul':
        return { callMe: PAUL_CALL, tryInBrowser: PAUL_WEB };
      case 'laura':
        return { callMe: LAURA_CALL, tryInBrowser: LAURA_WEB };
      default:
        return { callMe: false, tryInBrowser: false };
    }
  };
  
  const selectedAgentFlags = selectedAgent ? getAgentFlags(selectedAgent) : null;
  const selectedAgentIsDisabled = selectedAgent ? (!selectedAgentFlags?.callMe && !selectedAgentFlags?.tryInBrowser) : false;
  return <div className="max-w-2xl mx-auto">
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
                {voiceAgents.map(agent => {
                  const agentFlags = getAgentFlags(agent.slug);
                  const agentIsDisabled = !agentFlags.callMe && !agentFlags.tryInBrowser;
                  return (
                    <SelectItem key={agent.slug} value={agent.slug} className="truncate">
                      <div className="flex items-center gap-2 truncate">
                        <span className="truncate">{agent.name} - {agent.category}</span>
                        {agentIsDisabled && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            Coming Soon
                          </div>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
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
              onChange={e => setPhoneNumber(e.target.value)} 
              placeholder="+1234567890" 
              className="font-mono" 
              disabled={isCallingPhone || isTryingBrowser} 
            />
            <p className="text-xs text-muted-foreground">
              Enter phone number starting with + and country code (e.g., +1234567890)
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Button 
                onClick={handleCallMe} 
                disabled={
                  isCallingPhone || 
                  isTryingBrowser || 
                  !phoneNumber || 
                  phoneNumber === "+1" || 
                  !selectedAgent ||
                  !selectedAgentFlags?.callMe
                } 
                className="w-full" 
                variant="default"
              >
                {isCallingPhone ? <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Calling...
                  </> : <>
                    <Phone className="w-4 h-4 mr-2" />
                    {selectedAgentFlags?.callMe ? 'Call Me' : 'Call Me (Coming Soon)'}
                  </>}
              </Button>
              {!selectedAgentFlags?.callMe && selectedAgent && (
                <p className="text-xs text-muted-foreground text-center">
                  Phone calling coming soon for this agent.
                </p>
              )}
            </div>
            
            <div className="space-y-1">
              <Button 
                onClick={handleTryInBrowser} 
                disabled={
                  isTryingBrowser || 
                  isCallingPhone || 
                  !selectedAgent ||
                  !selectedAgentFlags?.tryInBrowser
                } 
                className="w-full" 
                variant="outline"
              >
                {isTryingBrowser ? <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </> : <>
                    <Monitor className="w-4 h-4 mr-2" />
                    {selectedAgentFlags?.tryInBrowser ? 'Try in Browser' : 'Try in Browser (Coming Soon)'}
                  </>}
              </Button>
              <p className="text-xs text-muted-foreground">
                {selectedAgentFlags?.tryInBrowser 
                  ? "This uses your microphone and plays audio in your browser. It won't call your phone."
                  : "Browser calling coming soon for this agent."
                }
              </p>
            </div>
          </div>
          
          {/* Coming Soon Message */}
          {selectedAgentIsDisabled && (
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-2 text-yellow-800 dark:text-yellow-200 text-sm">
                <Clock className="w-4 h-4" />
                This agent is coming soon. Try Jessica for full functionality!
              </div>
            </div>
          )}

          {/* Call from Phone */}
          {selectedAgent && agentPhoneNumber && <div className="space-y-2">
              <p className="text-sm text-muted-foreground">or call from phone</p>
              <div className="flex items-center justify-between bg-muted/30 p-3 rounded border">
                <a href={`tel:${agentPhoneNumber}`} className="font-bold text-lg hover:underline">
                  {agentPhoneNumber}
                </a>
                <Button variant="ghost" size="sm" onClick={() => handleCopyPhone(agentPhoneNumber)} className="h-8 px-2">
                  <Copy className="w-3 h-3" />
                  <span className="sr-only">Copy phone number</span>
                </Button>
              </div>
              
            </div>}

          {/* Status Messages */}
          {statusMessage && <div className={`text-sm p-3 rounded break-words ${statusMessage.includes("Error") ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"}`} role="status" aria-live="polite">
              {statusMessage}
            </div>}

           {/* Trace ID */}
           {traceId && <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded font-mono break-all">
               <strong>Trace ID:</strong> <span className="break-all">{traceId}</span>
             </div>}

           {/* Debug Section */}
           <Collapsible open={isDebugOpen} onOpenChange={setIsDebugOpen}>
             <CollapsibleTrigger asChild>
               <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground h-8">
                 Debug
                 <ChevronDown className={`w-3 h-3 transition-transform ${isDebugOpen ? 'rotate-180' : ''}`} />
               </Button>
             </CollapsibleTrigger>
             <CollapsibleContent className="space-y-2">
               <div className="text-xs space-y-2 p-3 bg-muted/30 rounded border">
                 <div className="grid grid-cols-2 gap-2">
                   <div>
                     <span className="text-muted-foreground">Last traceId:</span>
                     <div className="font-mono break-all">{traceId || "—"}</div>
                   </div>
                   <div>
                     <span className="text-muted-foreground">Last call_id:</span>
                     <div className="font-mono">{maskCallId(sessionData?.call_id)}</div>
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                   <div>
                     <span className="text-muted-foreground">Last error status:</span>
                     <div className="font-mono">{lastErrorStatus || "—"}</div>
                   </div>
                   <div>
                     <Button 
                       variant="ghost" 
                       size="sm" 
                       onClick={handleCopyLogs}
                       disabled={!lastPayload}
                       className="h-6 px-2 text-xs"
                     >
                       <Copy className="w-3 h-3 mr-1" />
                       Copy logs
                     </Button>
                   </div>
                 </div>
               </div>
             </CollapsibleContent>
           </Collapsible>

         </CardContent>
       </Card>

      {/* Browser Call Modal */}
      <BrowserCallModal isOpen={isBrowserCallOpen} onClose={() => setIsBrowserCallOpen(false)} sessionData={sessionData} traceId={traceId} agentName={selectedAgentData?.name || "Agent"} />
    </div>;
}