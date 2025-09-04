import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Mic, MicOff, Phone, ChevronDown, Copy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RetellWebClient } from "retell-client-js-sdk";

interface BrowserCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionData: {
    call_id?: string;
    client_secret?: string;
    access_token?: string;
  } | null;
  traceId?: string;
  agentName: string;
}

type CallStatus = "connecting" | "connected" | "ended" | "failed";

export function BrowserCallModal({ 
  isOpen, 
  onClose, 
  sessionData, 
  traceId, 
  agentName 
}: BrowserCallModalProps) {
  const [status, setStatus] = useState<CallStatus>("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [error, setError] = useState<string>("");
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  
  const { toast } = useToast();
  const retellClientRef = useRef<RetellWebClient | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen && sessionData?.access_token) {
      initializeCall();
    }

    return () => {
      cleanup();
    };
  }, [isOpen, sessionData]);

  const cleanup = () => {
    console.log("Cleaning up browser call resources...");
    
    // Stop Retell client
    if (retellClientRef.current) {
      try {
        retellClientRef.current.stopCall();
        console.log("Retell client stopped");
      } catch (error) {
        console.warn("Error stopping Retell client:", error);
      }
      retellClientRef.current = null;
    }
    
    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log("Stopped track:", track.label);
      });
      streamRef.current = null;
    }
  };

  const initializeCall = async () => {
    try {
      console.log("Initializing browser call with sessionData:", sessionData);
      
      if (!sessionData?.access_token) {
        throw new Error("No access token provided");
      }

      setError("");
      setMicPermissionDenied(false);
      setStatus("connecting");

      // Request microphone permission first
      console.log("Requesting microphone permission...");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 24000,
            channelCount: 1
          } 
        });
        
        streamRef.current = stream;
        console.log("Microphone permission granted, got stream:", stream);
        
      } catch (permError: any) {
        console.error("Microphone permission denied:", permError);
        setMicPermissionDenied(true);
        setError("Microphone permission required. Please allow microphone access and try again.");
        setStatus("failed");
        
        toast({
          title: "Microphone required",
          description: "Please allow microphone access to start the call",
          variant: "destructive",
        });
        return;
      }

      // Initialize Retell Web Client
      console.log("Initializing Retell Web Client...");
      const retellClient = new RetellWebClient();
      retellClientRef.current = retellClient;

      // Set up event listeners
      retellClient.on("call_started", () => {
        console.log("Call started event received");
        setStatus("connected");
        toast({
          title: "Connected",
          description: `Browser call with ${agentName} started`,
        });
      });

      retellClient.on("call_ended", () => {
        console.log("Call ended event received");
        setStatus("ended");
        toast({
          title: "Call ended",
          description: "Browser call session ended",
        });
        onClose();
      });

      retellClient.on("agent_start_talking", () => {
        console.log("Agent started talking");
      });

      retellClient.on("agent_stop_talking", () => {
        console.log("Agent stopped talking");
      });

      retellClient.on("error", (error) => {
        console.error("Retell client error:", error);
        setError(`Connection error: ${error.message || 'Unknown error'}`);
        setStatus("failed");
        toast({
          title: "Call failed",
          description: error.message || "Connection error occurred",
          variant: "destructive",
        });
      });

      retellClient.on("update", (update) => {
        console.log("Call update:", update);
      });

      // Start the call with the access token
      console.log("Starting call with access token:", sessionData.access_token.slice(0, 12) + "...");
      await retellClient.startCall({
        accessToken: sessionData.access_token,
      });

      console.log("Call initialization completed");

    } catch (error: any) {
      console.error("Failed to initialize call:", error, "traceId:", traceId);
      
      setError(`Connection failed: ${error.message || 'Unknown error'} ${traceId ? `(traceId: ${traceId})` : ""}`);
      setStatus("failed");
      
      toast({
        title: "Call failed",
        description: error.message || "Failed to connect",
        variant: "destructive",
      });
    }
  };

  const handleMuteToggle = () => {
    console.log("Toggling mute state, current isMuted:", isMuted);
    
    if (retellClientRef.current) {
      try {
        if (isMuted) {
          // Unmute - enable microphone
          if (streamRef.current) {
            streamRef.current.getAudioTracks().forEach(track => {
              track.enabled = true;
            });
          }
          console.log("Microphone enabled");
        } else {
          // Mute - disable microphone
          if (streamRef.current) {
            streamRef.current.getAudioTracks().forEach(track => {
              track.enabled = false;
            });
          }
          console.log("Microphone disabled");
        }
        
        setIsMuted(!isMuted);
        
        toast({
          title: isMuted ? "Unmuted" : "Muted",
          description: isMuted ? "Microphone enabled" : "Microphone disabled",
        });
      } catch (error) {
        console.error("Error toggling mute:", error);
        toast({
          title: "Error",
          description: "Failed to toggle microphone",
          variant: "destructive",
        });
      }
    } else {
      console.warn("Retell client not available for mute toggle");
    }
  };

  const handleEndCall = () => {
    console.log("Ending call");
    cleanup();
    setStatus("ended");
    
    toast({
      title: "Call ended",
      description: "Browser call session ended",
    });
    
    onClose();
  };

  const handleCopyAccessToken = async () => {
    if (sessionData?.access_token) {
      try {
        await navigator.clipboard.writeText(sessionData.access_token);
        toast({
          title: "Access token copied",
          description: "Token copied to clipboard",
        });
      } catch (error) {
        toast({
          title: "Failed to copy",
          description: "Please copy manually",
          variant: "destructive",
        });
      }
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "connecting": return "Connecting...";
      case "connected": return "Connected";
      case "ended": return "Ended";
      case "failed": return "Failed";
      default: return "Unknown";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "connecting": return "text-yellow-600";
      case "connected": return "text-green-600";
      case "ended": return "text-gray-600";
      case "failed": return "text-red-600";
      default: return "text-gray-600";
    }
  };

  const maskCallId = (callId?: string) => {
    if (!callId) return "";
    if (callId.length <= 8) return callId;
    return `${callId.slice(0, 4)}...${callId.slice(-4)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Browser Call</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Status with loading indicator */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <div className="flex items-center gap-2">
              {status === "connecting" && (
                <Loader2 className="w-4 h-4 animate-spin text-yellow-600" />
              )}
              <span className={`text-sm font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
          </div>

          {/* Microphone Permission Prompt */}
          {micPermissionDenied && (
            <div className="text-sm bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200">
              <div className="font-medium">Microphone access required</div>
              <div className="mt-1">Please allow microphone access in your browser and try again.</div>
            </div>
          )}

          {/* Error Message */}
          {error && !micPermissionDenied && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200 dark:bg-red-950 dark:border-red-800 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMuteToggle}
              disabled={status !== "connected"}
              className="flex-1"
            >
              {isMuted ? (
                <>
                  <MicOff className="w-4 h-4 mr-2" />
                  Unmute
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Mute
                </>
              )}
            </Button>
            
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEndCall}
              disabled={status === "ended"}
              className="flex-1"
            >
              <Phone className="w-4 h-4 mr-2" />
              End Call
            </Button>
          </div>

          {/* Debug Section */}
          <Collapsible open={isDebugOpen} onOpenChange={setIsDebugOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between p-2">
                <span className="text-xs">Debug</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              <div className="text-xs space-y-1 bg-muted/50 p-3 rounded font-mono">
                {traceId && (
                  <div><strong>traceId:</strong> {traceId}</div>
                )}
                {sessionData?.call_id && (
                  <div><strong>call_id:</strong> {maskCallId(sessionData.call_id)}</div>
                )}
                {sessionData?.access_token && (
                  <div className="flex items-center justify-between">
                    <span><strong>access_token:</strong> {sessionData.access_token.slice(0, 12)}...</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyAccessToken}
                      className="h-6 px-2"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DialogContent>
    </Dialog>
  );
}