import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Phone, Monitor, Loader2, AudioWaveform } from "lucide-react";
import { callEF } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";

interface VoiceDemoCardSynthflowProps {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  category?: string;
  subtitle?: string;
  showActions?: boolean;
  onCardClick?: (slug: string) => void;
}

export function VoiceDemoCardSynthflow({ 
  slug, 
  name, 
  description, 
  tags,
  category,
  subtitle,
  showActions = true,
  onCardClick
}: VoiceDemoCardSynthflowProps) {
  const [phoneNumber, setPhoneNumber] = useState("+1");
  const [isCallingPhone, setIsCallingPhone] = useState(false);
  const [isTryingBrowser, setIsTryingBrowser] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [traceId, setTraceId] = useState("");
  const [callError, setCallError] = useState<any>(null);
  const [browserError, setBrowserError] = useState<any>(null);
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
    setCallError(null);
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
      console.error('Error initiating call:', error);
      setCallError(error);
      
      if (error?.traceId) {
        setTraceId(error.traceId);
      }
      
      const errorMsg = getErrorMessage(error);
      toast({
        title: "Call failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsCallingPhone(false);
    }
  };

  const handleTryInBrowser = async () => {
    setIsTryingBrowser(true);
    setStatusMessage("");
    setBrowserError(null);
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
      
      toast({
        title: "Web call session ready!",
        description: "Session created successfully. Browser audio coming soon.",
      });
    } catch (error: any) {
      console.error('Error creating web call:', error);
      setBrowserError(error);
      
      if (error?.traceId) {
        setTraceId(error.traceId);
      }
      
      const errorMsg = getErrorMessage(error);
      toast({
        title: "Web call failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsTryingBrowser(false);
    }
  };

  // Get icon color based on agent slug
  const getIconColor = (slug: string) => {
    switch (slug) {
      case 'paul': return 'text-red-500';
      case 'laura': return 'text-green-500';
      case 'jessica': return 'text-blue-500';
      default: return 'text-primary';
    }
  };

  // If no actions, return compact card
  if (!showActions) {
    return (
      <Card 
        className="playground-card bg-card/50 backdrop-blur-sm border border-border/50 hover:shadow-lg transition-all duration-300 cursor-pointer"
        onClick={() => onCardClick?.(slug)}
      >
        <div className="p-4 min-h-[140px] flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-2">
                {category && (
                  <h3 className="text-base font-semibold leading-tight">{category}</h3>
                )}
                {subtitle && (
                  <p className="text-xs font-medium text-muted-foreground mt-1">{subtitle}</p>
                )}
              </div>
              <AudioWaveform className={`w-5 h-5 ${getIconColor(slug)} animate-pulse flex-shrink-0`} />
            </div>
            
            {/* Tags */}
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag} className="tag-chip text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground leading-relaxed break-words mt-2">{description}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="playground-card bg-card/50 backdrop-blur-sm border border-border/50 hover:shadow-lg transition-all duration-300">
      <div className="flex flex-col lg:flex-row">
        {/* Left side - Content */}
        <div className="flex-1 p-6">
          <div className="space-y-3">
            {category && (
              <h3 className="text-lg font-semibold leading-tight">{category}</h3>
            )}
            {subtitle && (
              <p className="text-sm font-medium text-muted-foreground">{subtitle}</p>
            )}
            
            {/* Tags */}
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag} className="tag-chip text-xs">
                  {tag}
                </span>
              ))}
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed break-words">{description}</p>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="w-full lg:w-80 p-6 border-t lg:border-t-0 lg:border-l border-border/20">
          <div className="space-y-4">
            {/* Phone Input */}
            <div className="space-y-2">
              <label htmlFor={`phone-${slug}`} className="text-sm font-medium">
                Phone Number
              </label>
              <Input
                id={`phone-${slug}`}
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1234567890"
                className="font-mono text-sm"
                aria-describedby={`phone-help-${slug}`}
                disabled={isCallingPhone || isTryingBrowser}
              />
              <p id={`phone-help-${slug}`} className="text-xs text-muted-foreground sr-only">
                Enter phone number in E.164 format, starting with + and country code
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                onClick={handleCallMe}
                disabled={isCallingPhone || isTryingBrowser || !phoneNumber || phoneNumber === "+1"}
                className="w-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                variant="default"
                aria-label={`Call ${name} on your phone`}
              >
                {isCallingPhone ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    Calling...
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4 mr-2" aria-hidden="true" />
                    Call Me
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleTryInBrowser}
                disabled={isTryingBrowser || isCallingPhone}
                className="w-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                variant="outline"
                aria-label={`Start ${name} in browser`}
              >
                {isTryingBrowser ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Monitor className="w-4 h-4 mr-2" aria-hidden="true" />
                    Try in Browser
                  </>
                )}
              </Button>
            </div>

            {/* Status Messages */}
            {statusMessage && (
              <div 
                className="text-xs p-2 rounded bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                role="status"
                aria-live="polite"
              >
                {statusMessage}
              </div>
            )}

            {/* Error Messages */}
            {callError && (
              <ErrorDisplay error={callError} traceId={traceId} />
            )}
            
            {browserError && (
              <ErrorDisplay error={browserError} traceId={traceId} />
            )}

            {/* Trace ID */}
            {traceId && !callError && !browserError && (
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded font-mono" role="status">
                <span className="sr-only">Trace ID: </span>
                Trace: {traceId}
              </div>
            )}

            {/* Session Details for Browser Demo */}
            {sessionData && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Session Details</h4>
                  <div 
                    className="text-xs space-y-1 bg-muted/50 p-3 rounded font-mono"
                    role="region"
                    aria-label="Web call session information"
                  >
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
          </div>
        </div>
      </div>
    </Card>
  );
}