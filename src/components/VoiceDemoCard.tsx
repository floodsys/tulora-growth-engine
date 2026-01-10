import { useState } from "react";
import { Phone, Globe, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { callEF } from "@/lib/api";
import { Link } from "react-router-dom";

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
  const [billingLimitError, setBillingLimitError] = useState<boolean>(false);
  const [quotaCheckError, setQuotaCheckError] = useState<boolean>(false);
  const [buttonsDisabledUntil, setButtonsDisabledUntil] = useState<number>(0);
  const { toast } = useToast();

  // Check if error is a BILLING_OVER_LIMIT error
  const isBillingOverLimit = (error: any): boolean => {
    return error?.originalPayload?.code === 'BILLING_OVER_LIMIT' ||
      error?.code === 'BILLING_OVER_LIMIT';
  };

  // Check if error is a BILLING_QUOTA_CHECK_ERROR (transient usage verification failure)
  const isBillingQuotaCheckError = (error: any): boolean => {
    return error?.originalPayload?.code === 'BILLING_QUOTA_CHECK_ERROR' ||
      error?.code === 'BILLING_QUOTA_CHECK_ERROR';
  };

  // Temporarily disable buttons after billing error
  const disableButtonsTemporarily = () => {
    setButtonsDisabledUntil(Date.now() + 5000); // 5 second cooldown
    setTimeout(() => setButtonsDisabledUntil(0), 5000);
  };

  const isButtonDisabled = () => Date.now() < buttonsDisabledUntil;

  const getErrorMessage = (error: any): { message: string; traceId?: string; details?: string } => {
    let message = "";
    let details = "";
    let traceId = "";

    // Extract traceId if available
    if (error?.traceId) {
      traceId = error.traceId;
    }

    // Check for HTTP status codes
    if (error?.message?.includes('400')) {
      message = "Invalid request - check phone number format and agent";
    } else if (error?.message?.includes('401')) {
      message = "Authentication missing - check Supabase configuration";
    } else if (error?.message?.includes('405')) {
      message = "Method not allowed - use POST only";
    } else if (error?.message?.includes('502')) {
      message = "Upstream error - server temporarily unavailable";
    } else if (error?.message?.includes('NON_JSON_RESPONSE')) {
      message = "Server returned non-JSON response";
      // Extract first ~200 chars from error message
      const fullMsg = error.message || "";
      const htmlMatch = fullMsg.match(/Expected JSON response but received: (.+)/);
      if (htmlMatch && htmlMatch[1]) {
        details = htmlMatch[1].substring(0, 200);
      }
    } else {
      message = error instanceof Error ? error.message : 'Unknown error occurred';
      // Try to extract first 200 chars if it looks like HTML/non-JSON
      if (typeof error === 'string' && error.includes('<')) {
        details = error.substring(0, 200);
      }
    }

    return { message, traceId, details };
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
    } catch (error: any) {
      console.error('Error initiating call:', error);

      if (isBillingOverLimit(error)) {
        setBillingLimitError(true);
        setQuotaCheckError(false);
        disableButtonsTemporarily();
        setErrorMessage("You've hit your plan's call limit for this month.");
        toast({
          title: "Call Limit Reached",
          description: "You've hit your plan's call limit for this month. Update your plan in Billing to continue.",
          variant: "destructive",
        });
      } else if (isBillingQuotaCheckError(error)) {
        // Transient error - don't show scary message
        setBillingLimitError(false);
        setQuotaCheckError(true);
        setErrorMessage("We're temporarily unable to verify your usage. Please try again in a moment.");
        toast({
          title: "Please try again",
          description: "We're temporarily unable to verify your usage. Please try again in a moment.",
          variant: "default",
        });
      } else {
        setBillingLimitError(false);
        setQuotaCheckError(false);
        const errorInfo = getErrorMessage(error);
        setErrorMessage(`Call failed: ${errorInfo.message}`);

        if (errorInfo.traceId) {
          setLastTraceId(errorInfo.traceId);
        }

        toast({
          title: "Call failed",
          description: errorInfo.message,
          variant: "destructive",
        });
      }
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

    } catch (error: any) {
      console.error('Error creating web call:', error);

      if (isBillingOverLimit(error)) {
        setBillingLimitError(true);
        setQuotaCheckError(false);
        disableButtonsTemporarily();
        setErrorMessage("You've hit your plan's call limit for this month.");
        toast({
          title: "Call Limit Reached",
          description: "You've hit your plan's call limit for this month. Update your plan in Billing to continue.",
          variant: "destructive",
        });
      } else if (isBillingQuotaCheckError(error)) {
        // Transient error - don't show scary message
        setBillingLimitError(false);
        setQuotaCheckError(true);
        setErrorMessage("We're temporarily unable to verify your usage. Please try again in a moment.");
        toast({
          title: "Please try again",
          description: "We're temporarily unable to verify your usage. Please try again in a moment.",
          variant: "default",
        });
      } else {
        setBillingLimitError(false);
        setQuotaCheckError(false);
        const errorInfo = getErrorMessage(error);
        setErrorMessage(`Web call failed: ${errorInfo.message}`);

        if (errorInfo.traceId) {
          setLastTraceId(errorInfo.traceId);
        }

        toast({
          title: "Web call failed",
          description: errorInfo.message,
          variant: "destructive",
        });
      }
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

            {/* Billing Limit Error Alert */}
            {billingLimitError && (
              <Alert variant="destructive" className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800 dark:text-orange-200">
                  You've hit your plan's call limit for this month.{" "}
                  <Link to="/dashboard?screen=billing" className="underline font-medium hover:text-orange-900">
                    Update your plan in Billing
                  </Link>{" "}
                  to continue.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                onClick={handleCallMe}
                disabled={isCallLoading || !phoneNumber.trim() || isButtonDisabled()}
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
                disabled={isBrowserLoading || isButtonDisabled()}
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
          <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border/20">
            {statusMessage && (
              <p className="text-sm text-muted-foreground">{statusMessage}</p>
            )}
            {errorMessage && (
              <div className="space-y-2">
                <p className="text-sm text-destructive font-medium">{errorMessage}</p>
                {/* Show first 200 chars of non-JSON responses */}
                {errorMessage.includes('non-JSON') && (
                  <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded border">
                    <div className="font-sans text-xs mb-1">Response preview:</div>
                    <div className="break-all">{errorMessage.substring(0, 200)}...</div>
                  </div>
                )}
              </div>
            )}
            {lastTraceId && (
              <p className="text-xs text-muted-foreground mt-2 font-mono">
                Trace ID: {lastTraceId}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
