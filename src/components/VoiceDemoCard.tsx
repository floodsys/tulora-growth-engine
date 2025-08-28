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
  const [browserStatus, setBrowserStatus] = useState<"idle" | "connected">("idle");
  const [lastTraceId, setLastTraceId] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const { toast } = useToast();

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
      setStatusMessage(`Call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast({
        title: "Call failed",
        description: "Unable to initiate the call. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCallLoading(false);
    }
  };

  const handleTryInBrowser = async () => {
    setIsBrowserLoading(true);
    setStatusMessage("");
    setLastTraceId("");
    try {
      const response = await callEF<{ traceId?: string }>('retell-webcall-create', {
        agentSlug: slug,
      });

      // Extract traceId if available  
      if (response?.traceId) {
        setLastTraceId(response.traceId);
      }

      setBrowserStatus("connected");
      setStatusMessage(`Web call ready${response?.traceId ? ` (${response.traceId})` : ''}`);
      
      toast({
        title: "Web call ready!",
        description: `Connected to ${name}. Start speaking!`,
      });

      // Auto-reset after 30 seconds for demo purposes
      setTimeout(() => {
        setBrowserStatus("idle");
      }, 30000);
    } catch (error) {
      console.error('Error creating web call:', error);
      setStatusMessage(`Web call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast({
        title: "Web call failed",
        description: "Unable to create web call. Please try again.",
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
        {browserStatus === "connected" ? (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-700 dark:text-green-300 font-medium">
                Connected — speak now
              </span>
            </div>
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
        
        {/* Status Message */}
        {statusMessage && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">{statusMessage}</p>
            {lastTraceId && (
              <p className="text-xs text-muted-foreground mt-1">Trace ID: {lastTraceId}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}