import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Status {
  portalEnabled: boolean;
  webhookReachable: boolean;
  allPaidPlansConfigured: boolean;
  isLiveReady: boolean;
}

interface ReadinessBannerProps {
  status: Status;
}

export function ReadinessBanner({ status }: ReadinessBannerProps) {
  const { portalEnabled, webhookReachable, allPaidPlansConfigured, isLiveReady } = status;
  
  const checks = [
    {
      label: "Live Customer Portal",
      status: portalEnabled,
      description: "Portal is configured and reachable"
    },
    {
      label: "Live Webhook Events",
      status: webhookReachable,
      description: "Required events are subscribed"
    },
    {
      label: "AI Plan Configuration",
      status: allPaidPlansConfigured,
      description: "All four paid plans (Lead Gen & Support Starter/Business) have Live price IDs"
    }
  ];
  
  const StatusIcon = ({ passed }: { passed: boolean }) => 
    passed ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );
  
  return (
    <Card className={`border-l-4 ${isLiveReady ? 'border-l-green-500 bg-green-50 dark:bg-green-950' : 'border-l-amber-500 bg-amber-50 dark:bg-amber-950'}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {isLiveReady ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            )}
            <div>
              <h3 className="font-semibold text-lg">
                Live Mode Readiness
              </h3>
              <p className="text-sm text-muted-foreground">
                {isLiveReady 
                  ? "All systems ready for Live Stripe integration" 
                  : "Complete the checklist below to enable Live mode"
                }
              </p>
            </div>
          </div>
          <Badge 
            variant={isLiveReady ? "default" : "secondary"}
            className={isLiveReady ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {isLiveReady ? "READY" : "PENDING"}
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {checks.map((check, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 rounded-lg border bg-background">
              <StatusIcon passed={check.status} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{check.label}</p>
                <p className="text-xs text-muted-foreground">{check.description}</p>
              </div>
            </div>
          ))}
        </div>
        
        {!isLiveReady && (
          <div className="mt-4 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Next steps:</strong> Complete the failing checks above to enable Live mode readiness. 
              All components must be configured with Live (not Test) mode settings.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}