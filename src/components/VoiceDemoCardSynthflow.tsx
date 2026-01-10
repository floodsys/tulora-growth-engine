import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Phone, Monitor, Loader2, AudioWaveform, Clock, AlertTriangle } from "lucide-react";
import { callEF } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { getAgentFeatureFlags, isAgentDisabled } from "@/lib/agent-feature-flags";
import { Link } from "react-router-dom";

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
  const [sessionData, setSessionData] = useState<{
    call_id?: string;
    client_secret?: string;
    access_token?: string;
  } | null>(null);
  const [billingLimitError, setBillingLimitError] = useState<boolean>(false);
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

  const validatePhoneNumber = (phone: string) => {
    // E.164 validation: starts with +, followed by digits, 7-15 digits total
    const e164Regex = /^\+[1-9]\d{6,14}$/;
    return e164Regex.test(phone);
  };

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
    } else if (error?.message?.includes('NON_JSON_RESPONSE') || error?.message?.includes('Expected JSON response but received:')) {
      message = "Server returned non-JSON response";
      // Extract first ~200 chars from error message
      const fullMsg = error.message || "";
      const htmlMatch = fullMsg.match(/Expected JSON response but received: (.+)/);
      if (htmlMatch && htmlMatch[1]) {
        details = htmlMatch[1].substring(0, 200);
      }
    } else {
      message = error?.message || 'Unknown error occurred';
      // Try to extract first 200 chars if it looks like HTML/non-JSON
      if (typeof error === 'string' && error.includes('<')) {
        details = error.substring(0, 200);
      }
    }

    return { message, traceId, details };
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

      setBillingLimitError(false);
      setStatusMessage("Call queued—your phone should ring shortly.");
      if (response?.traceId) {
        setTraceId(response.traceId);
      }

      toast({
        title: "Call queued",
        description: `Your phone should ring shortly for ${name}`,
      });
    } catch (error: any) {
      if (isBillingOverLimit(error)) {
        setBillingLimitError(true);
        disableButtonsTemporarily();
        setStatusMessage("You've hit your plan's call limit for this month.");
        toast({
          title: "Call Limit Reached",
          description: "You've hit your plan's call limit for this month. Update your plan in Billing to continue.",
          variant: "destructive",
        });
      } else if (isBillingQuotaCheckError(error)) {
        // Transient error - don't show scary message
        setBillingLimitError(false);
        setStatusMessage("We're temporarily unable to verify your usage. Please try again in a moment.");
        toast({
          title: "Please try again",
          description: "We're temporarily unable to verify your usage. Please try again in a moment.",
          variant: "default",
        });
      } else {
        setBillingLimitError(false);
        const errorInfo = getErrorMessage(error);
        setStatusMessage(`Error: ${errorInfo.message}`);

        if (errorInfo.traceId) {
          setTraceId(errorInfo.traceId);
        }
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

      setBillingLimitError(false);
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
      if (isBillingOverLimit(error)) {
        setBillingLimitError(true);
        disableButtonsTemporarily();
        setStatusMessage("You've hit your plan's call limit for this month.");
        toast({
          title: "Call Limit Reached",
          description: "You've hit your plan's call limit for this month. Update your plan in Billing to continue.",
          variant: "destructive",
        });
      } else if (isBillingQuotaCheckError(error)) {
        // Transient error - don't show scary message
        setBillingLimitError(false);
        setStatusMessage("We're temporarily unable to verify your usage. Please try again in a moment.");
        toast({
          title: "Please try again",
          description: "We're temporarily unable to verify your usage. Please try again in a moment.",
          variant: "default",
        });
      } else {
        setBillingLimitError(false);
        const errorInfo = getErrorMessage(error);
        setStatusMessage(`Error: ${errorInfo.message}`);

        if (errorInfo.traceId) {
          setTraceId(errorInfo.traceId);
        }
      }
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

  const agentFlags = getAgentFeatureFlags(slug);
  const agentIsDisabled = isAgentDisabled(slug);

  // If no actions, return compact card
  if (!showActions) {
    return (
      <Card
        className={`playground-card bg-card/50 backdrop-blur-sm border border-border/50 hover:shadow-lg transition-all duration-300 cursor-pointer relative ${agentIsDisabled ? 'opacity-75' : ''
          }`}
        onClick={() => onCardClick?.(slug)}
      >
        {/* Coming Soon Ribbon */}
        {agentIsDisabled && (
          <div className="absolute top-3 right-3 bg-yellow-500/90 text-yellow-950 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 z-10">
            <Clock className="w-3 h-3" />
            Coming Soon
          </div>
        )}

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
              <AudioWaveform className={`w-5 h-5 ${getIconColor(slug)} ${agentIsDisabled ? 'opacity-50' : 'animate-pulse'} flex-shrink-0`} />
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
    <Card className={`playground-card bg-card/50 backdrop-blur-sm border border-border/50 hover:shadow-lg transition-all duration-300 relative ${agentIsDisabled ? 'opacity-90' : ''
      }`}>
      {/* Coming Soon Ribbon */}
      {agentIsDisabled && (
        <div className="absolute top-4 right-4 bg-yellow-500/90 text-yellow-950 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 z-10">
          <Clock className="w-3 h-3" />
          Coming Soon
        </div>
      )}

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

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                onClick={handleCallMe}
                disabled={!agentFlags.callMe || isCallingPhone || isTryingBrowser || !phoneNumber || phoneNumber === "+1" || isButtonDisabled()}
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
                    {agentFlags.callMe ? 'Call Me' : 'Call Me (Coming Soon)'}
                  </>
                )}
              </Button>

              <Button
                onClick={handleTryInBrowser}
                disabled={!agentFlags.tryInBrowser || isTryingBrowser || isCallingPhone || isButtonDisabled()}
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
                    {agentFlags.tryInBrowser ? 'Try in Browser' : 'Try in Browser (Coming Soon)'}
                  </>
                )}
              </Button>

              {agentIsDisabled && (
                <p className="text-xs text-muted-foreground text-center italic mt-2">
                  This agent is coming soon. Try Jessica for now!
                </p>
              )}
            </div>

            {/* Status Messages */}
            {statusMessage && (
              <div
                className={`text-xs p-2 rounded border ${statusMessage.includes("Error")
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                  }`}
                role="status"
                aria-live="polite"
              >
                <div className="font-medium">{statusMessage}</div>
                {/* Show first 200 chars of non-JSON responses for errors */}
                {statusMessage.includes("non-JSON") && (
                  <div className="mt-2 text-xs text-muted-foreground font-mono bg-muted p-2 rounded border">
                    <div className="font-sans text-xs mb-1">Response preview:</div>
                    <div className="break-all">{statusMessage.substring(0, 200)}...</div>
                  </div>
                )}
              </div>
            )}

            {/* Trace ID */}
            {traceId && (
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
