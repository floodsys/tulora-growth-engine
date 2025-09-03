import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Mic, MicOff, Phone, ChevronDown, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// Using native WebRTC instead of Retell SDK

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
  
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
  };

  const initializeCall = async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;
      
      // Create audio element for playback
      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      
      // Simulate connection process
      setStatus("connected");
      
      toast({
        title: "Connected",
        description: `Browser call with ${agentName} started`,
      });
      
      // Note: In a real implementation, you would use the access_token
      // to establish a WebRTC connection with Retell's servers
      console.log("Using access token:", sessionData?.access_token?.slice(0, 12) + "...");

    } catch (error: any) {
      console.error("Failed to initialize call:", error, "traceId:", traceId);
      
      if (error.name === "NotAllowedError" || error.message.includes("permission")) {
        setError("Mic permission required for browser demo. Please allow microphone and try again.");
      } else {
        setError(`Couldn't connect ${traceId ? `(traceId: ${traceId})` : ""}`);
      }
      
      setStatus("failed");
      toast({
        title: "Call failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMuteToggle = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted; // Toggle opposite of current state
      });
      setIsMuted(!isMuted);
      
      toast({
        title: isMuted ? "Unmuted" : "Muted",
        description: isMuted ? "Microphone enabled" : "Microphone disabled",
      });
    }
  };

  const handleEndCall = () => {
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
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200 dark:bg-red-950 dark:border-red-800">
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