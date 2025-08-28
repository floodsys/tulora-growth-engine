import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Phone, Monitor, Loader2 } from "lucide-react";
import { callEF } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface VoiceDemoCardSynthflowProps {
  slug: string;
  name: string;
  description: string;
  tags: string[];
}

export function VoiceDemoCardSynthflow({ 
  slug, 
  name, 
  description, 
  tags 
}: VoiceDemoCardSynthflowProps) {
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
        agentSlug: slug,
        toNumber: phoneNumber,
      }) as any;
      
      setStatusMessage("Call queued—your phone should ring shortly.");
      if (response?.traceId) {
        setTraceId(response.traceId);
      }
      
      toast({
        title: "Call queued",
        description: `Your phone should ring shortly for ${name}`,
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
    setIsTryingBrowser(true);
    setStatusMessage("");
    setTraceId("");
    setSessionData(null);

    try {
      const payload = await callEF("retell-webcall-create", {
        agentSlug: slug,
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
    <Card className="playground-card bg-card/50 backdrop-blur-sm border border-border/50 hover:shadow-lg transition-all duration-300">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{name}</h3>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map((tag) => (
            <span key={tag} className="tag-chip">
              {tag}
            </span>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Phone Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Phone Number</label>
          <Input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1234567890"
            className="font-mono text-sm"
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button
            onClick={handleCallMe}
            disabled={isCallingPhone || !phoneNumber || phoneNumber === "+1"}
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
            disabled={isTryingBrowser}
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
          <div className={`text-xs p-2 rounded ${
            statusMessage.includes("Error") 
              ? "bg-destructive/10 text-destructive border border-destructive/20" 
              : "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
          }`}>
            {statusMessage}
          </div>
        )}

        {/* Trace ID */}
        {traceId && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded font-mono">
            Trace: {traceId}
          </div>
        )}

        {/* Session Details for Browser Demo */}
        {sessionData && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Session Details</h4>
              <div className="text-xs space-y-1 bg-muted/50 p-3 rounded font-mono">
                <div><strong>call_id:</strong> {sessionData.call_id}</div>
                <div><strong>client_secret:</strong> {sessionData.client_secret}</div>
                <div><strong>access_token:</strong> {sessionData.access_token}</div>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Browser audio coming soon.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}