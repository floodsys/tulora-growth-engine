import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Status {
  portalEnabled: boolean;
  webhookReachable: boolean;
}

interface StripeStatusCardProps {
  status: Status;
  onRefresh: () => void;
  refreshing: boolean;
}

export function StripeStatusCard({ status, onRefresh, refreshing }: StripeStatusCardProps) {
  const allGood = status.portalEnabled && status.webhookReachable;
  
  return (
    <Card className={`border-l-4 ${allGood ? 'border-l-green-500' : 'border-l-red-500'}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">Stripe Configuration Status</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-3">
            {status.portalEnabled ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <div>
              <p className="font-medium">Customer Portal</p>
              <p className="text-sm text-muted-foreground">
                {status.portalEnabled ? 'Configured and accessible' : 'Not configured or inaccessible'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {status.webhookReachable ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <div>
              <p className="font-medium">Webhook Endpoint</p>
              <p className="text-sm text-muted-foreground">
                {status.webhookReachable ? 'Reachable and responding' : 'Unreachable or not responding'}
              </p>
            </div>
          </div>
        </div>
        
        {!allGood && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Configuration Issues Detected</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Some Stripe components are not properly configured. Check your Stripe dashboard settings and webhook configuration.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}