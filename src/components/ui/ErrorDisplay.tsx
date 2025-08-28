import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorDisplayProps {
  error: any;
  traceId?: string;
}

export function ErrorDisplay({ error, traceId }: ErrorDisplayProps) {
  const [showRaw, setShowRaw] = useState(false);
  
  const getStatusMessage = (error: any): string => {
    if (error?.message?.includes('400')) return "Check the fields (E.164 phone, agent).";
    if (error?.message?.includes('401')) return "Auth missing — set VITE_SUPABASE_ANON_KEY.";
    if (error?.message?.includes('405')) return "Use POST only.";
    if (error?.message?.includes('502')) return "Upstream error — try again.";
    return error instanceof Error ? error.message : 'Unknown error';
  };

  const getRawPreview = (error: any): string | null => {
    if (typeof error?.message === 'string') {
      // Look for non-JSON response patterns in the message
      const htmlMatch = error.message.match(/Expected JSON response but got: (.+)/);
      if (htmlMatch) {
        return htmlMatch[1];
      }
      
      const responseMatch = error.message.match(/Edge function returned non-JSON response.*?: (.+)/);
      if (responseMatch) {
        return responseMatch[1];
      }
    }
    return null;
  };

  const statusMessage = getStatusMessage(error);
  const rawPreview = getRawPreview(error);

  return (
    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
      <div className="text-sm text-destructive mb-2">
        {statusMessage}
      </div>
      
      {traceId && (
        <div className="text-xs text-muted-foreground mb-2 font-mono">
          Trace ID: {traceId}
        </div>
      )}
      
      {rawPreview && (
        <div className="mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRaw(!showRaw)}
            className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showRaw ? (
              <ChevronDown className="h-3 w-3 mr-1" />
            ) : (
              <ChevronRight className="h-3 w-3 mr-1" />
            )}
            Raw
          </Button>
          
          {showRaw && (
            <div className="mt-1 p-2 bg-muted/50 rounded text-xs font-mono text-muted-foreground border-l-2 border-muted-foreground/20">
              {rawPreview}
            </div>
          )}
        </div>
      )}
    </div>
  );
}