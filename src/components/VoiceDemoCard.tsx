import { useState } from "react";
import { Phone, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { callEF } from "@/lib/api";

interface VoiceDemoCardProps {
  slug: string;
  name: string;
  description: string;
  tags: string[];
}

export function VoiceDemoCard({ slug, name, description, tags }: VoiceDemoCardProps) {
  const [phoneNumber, setPhoneNumber] = useState("+1");
  const [isCallLoading, setIsCallLoading] = useState(false);
  const [isBrowserLoading, setIsBrowserLoading] = useState(false);
  const [browserSessionData, setBrowserSessionData] = useState<any>(null);
  const [lastTraceId, setLastTraceId] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const { toast } = useToast();

  const getErrorMessage = (error: any): string => {
    if (error?.message?.includes('400')) return "Check the fields (E.164 phone, agent).";
    if (error?.message?.includes('401')) return "Auth missing — set VITE_SUPABASE_ANON_KEY.";
    if (error?.message?.includes('405')) return "Use POST only.";
    if (error?.message?.includes('502')) return "Upstream error — try again.";
    return error instanceof Error ? error.message : 'Unknown error';
  };

  const validatePhoneNumber = (phone: string): boolean => {
    // Basic E.164 validation
    const e164Regex = /^\+\d{10,15}$/;
    return e164Regex.test(phone);
  };

  const handleCallMe = async () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Phone number required",
        description: "Please enter a valid phone number in E.164 format (+1234567890)",
        variant: "destructive",
      });
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      toast({
        title: "Invalid phone number",
        description: "Please use E.164 format: +1234567890",
        variant: "destructive",
      });
      return;
    }

    setIsCallLoading(true);
    setStatusMessage("");
    setErrorMessage("");
    setLastTraceId("");
    try {
      const response = await callEF<{ traceId?: string }>('retell-outbound', {
        agentSlug: slug,
        toNumber: phoneNumber,
      });

      // Extract traceId if available
      if (response?.traceId) {
        setLastTraceId(response.traceId);
      }
      
      setStatusMessage(`Call initiated successfully${response?.traceId ? ` (${response.traceId})` : ''}`);
      
      toast({
        title: "Call initiated!",
        description: `${name} will call you at ${phoneNumber} shortly.`,
      });
    } catch (error) {
      console.error('Error initiating call:', error);
      const errorMsg = getErrorMessage(error);
      setErrorMessage(`Call failed: ${errorMsg}`);
      toast({
        title: "Call failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsCallLoading(false);
    }
  };

  const handleTryInBrowser = async () => {
    setIsBrowserLoading(true);
    setStatusMessage("");
    setErrorMessage("");
    setLastTraceId("");
    setBrowserSessionData(null);
    try {
      const response = await callEF<{ traceId?: string }>('retell-webcall-create', {
        agentSlug: slug,
      });

      // Extract traceId if available  
      if (response?.traceId) {
        setLastTraceId(response.traceId);
      }

      // Store session data for display
      setBrowserSessionData(response);
      setStatusMessage(`Web call session created${response?.traceId ? ` (${response.traceId})` : ''}`);
      
      toast({
        title: "Web call session ready!",
        description: `Session created for ${name}. Browser audio coming soon.`,
      });

    } catch (error) {
      console.error('Error creating web call:', error);
      const errorMsg = getErrorMessage(error);
      setErrorMessage(`Web call failed: ${errorMsg}`);
      toast({
        title: "Web call failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsBrowserLoading(false);
    }
  };

  return (
    <Card className="h-full rounded-2xl shadow-lg shadow-primary/10">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{name}</CardTitle>
            <CardDescription className="mt-2">{description}</CardDescription>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-3">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {browserSessionData ? (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Session Details</h4>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                {browserSessionData.call_id && (
                  <div><span className="font-medium">Call ID:</span> {browserSessionData.call_id}</div>
                )}
                {browserSessionData.client_secret && (
                  <div><span className="font-medium">Client Secret:</span> {browserSessionData.client_secret.slice(0, 20)}...</div>
                )}
                {browserSessionData.access_token && (
                  <div><span className="font-medium">Access Token:</span> {browserSessionData.access_token.slice(0, 20)}...</div>
                )}
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-2 italic">
                Browser audio coming soon.
              </p>
            </div>
            
            <Button
              onClick={() => setBrowserSessionData(null)}
              variant="outline"
              className="w-full"
            >
              Reset Session
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label htmlFor={`phone-${slug}`} className="text-sm font-medium">
                Your Phone Number
              </label>
              <Input
                id={`phone-${slug}`}
                type="tel"
                placeholder="+1234567890"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Use E.164 format (e.g., +1234567890)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                onClick={handleCallMe}
                disabled={isCallLoading || !phoneNumber.trim()}
                className="w-full"
                variant="default"
              >
                {isCallLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Phone className="h-4 w-4 mr-2" />
                )}
                Call Me
              </Button>

              <Button
                onClick={handleTryInBrowser}
                disabled={isBrowserLoading}
                variant="outline"
                className="w-full"
              >
                {isBrowserLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4 mr-2" />
                )}
                Try in Browser
              </Button>
            </div>
          </>
        )}
        
        {/* Status/Error Messages */}
        {(statusMessage || errorMessage) && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            {statusMessage && (
              <p className="text-sm text-muted-foreground">{statusMessage}</p>
            )}
            {errorMessage && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
            {lastTraceId && (
              <p className="text-xs text-muted-foreground mt-1">Trace ID: {lastTraceId}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}