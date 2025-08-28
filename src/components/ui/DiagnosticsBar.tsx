import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

interface LastCallInfo {
  status?: number;
  parsed: boolean;
  traceId?: string;
  timestamp?: number;
}

let lastCallInfo: LastCallInfo = { parsed: true };

// Global function to update last call info
export const updateLastCallInfo = (info: LastCallInfo) => {
  lastCallInfo = { ...info, timestamp: Date.now() };
  // Trigger re-render for all DiagnosticsBar instances
  window.dispatchEvent(new CustomEvent('diagnostics-update'));
};

export function DiagnosticsBar() {
  const [callInfo, setCallInfo] = useState<LastCallInfo>(lastCallInfo);

  // Only show in development
  if (!import.meta.env.DEV) {
    return null;
  }

  useEffect(() => {
    const handleUpdate = () => setCallInfo({ ...lastCallInfo });
    window.addEventListener('diagnostics-update', handleUpdate);
    return () => window.removeEventListener('diagnostics-update', handleUpdate);
  }, []);

  const hasSupabaseUrl = !!import.meta.env.VITE_SUPABASE_URL;
  const hasAnonKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY;

  const getStatusBadge = (status?: number) => {
    if (!status) return <Badge variant="outline">No calls</Badge>;
    
    const variant = status >= 200 && status < 300 ? "default" : "destructive";
    return <Badge variant={variant}>{status}</Badge>;
  };

  const getParsedBadge = (parsed: boolean, status?: number) => {
    if (!status) return null;
    
    return (
      <Badge variant={parsed ? "secondary" : "destructive"}>
        {parsed ? "JSON" : "non-JSON"}
      </Badge>
    );
  };

  return (
    <Alert className="mb-4 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
      <Info className="h-4 w-4" />
      <AlertDescription className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">Config:</span>
          <span>SUPABASE_URL {hasSupabaseUrl ? "✅" : "❌"}</span>
          <span>ANON_KEY {hasAnonKey ? "✅" : "❌"}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="font-medium">Last call:</span>
          {getStatusBadge(callInfo.status)}
          {getParsedBadge(callInfo.parsed, callInfo.status)}
          {callInfo.traceId && (
            <Badge variant="outline" className="font-mono text-xs">
              {callInfo.traceId}
            </Badge>
          )}
          {callInfo.timestamp && (
            <span className="text-xs text-muted-foreground">
              {new Date(callInfo.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}