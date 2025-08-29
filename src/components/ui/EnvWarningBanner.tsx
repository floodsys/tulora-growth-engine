import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { checkDevEnv } from "@/lib/api";

export function EnvWarningBanner() {
  const envCheck = checkDevEnv();
  
  // Only show in development and if env vars are missing
  if (!import.meta.env.DEV || envCheck.isComplete) {
    return null;
  }

  return (
    <Alert className="mb-4 border-orange-500/20 bg-orange-500/10">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="text-orange-700">
        <strong>Development Mode:</strong> {envCheck.warning}
      </AlertDescription>
    </Alert>
  );
}