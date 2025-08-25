import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldX, Timer, TrendingUp, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRateLimitHandler } from '@/hooks/useRateLimitHandler';
import { useToast } from '@/hooks/use-toast';

export function RateLimitTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitStatus, setRateLimitStatus] = useState<any>(null);
  const { handleRateLimitedResponse, getRateLimitStatus } = useRateLimitHandler();
  const { toast } = useToast();

  const testEndpoints = [
    { name: 'Suspend Organization', endpoint: 'suspend_organization', limit: '10/min' },
    { name: 'Reinstate Organization', endpoint: 'reinstate_organization', limit: '10/min' },
    { name: 'Step-up Auth', endpoint: 'verify_step_up_auth', limit: '20/min' },
    { name: 'Destructive Action', endpoint: 'admin_destructive_action', limit: '5/min' },
    { name: 'Plan Change', endpoint: 'change_plan', limit: '10/min' }
  ];

  const testRateLimit = async (endpoint: string) => {
    setIsLoading(true);
    try {
      // Call the rate limit check function directly
      const { data, error } = await supabase.rpc('check_rate_limit', {
        p_endpoint: endpoint
      });

      if (error) throw error;

      const rateLimitInfo = data as any;
      setRateLimitStatus({ endpoint, ...rateLimitInfo });

      if (!rateLimitInfo.allowed) {
        handleRateLimitedResponse({
          success: false,
          error: 'Rate limit exceeded',
          error_code: 'rate_limited',
          rate_limit_info: rateLimitInfo
        });
      } else {
        const status = getRateLimitStatus(rateLimitInfo);
        toast({
          title: 'Rate Limit Check Passed',
          description: `${endpoint}: ${status?.remaining}/${status?.limit} requests remaining`,
        });
      }
    } catch (err) {
      console.error('Rate limit test error:', err);
      toast({
        title: 'Test Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testMultipleRequests = async (endpoint: string, count: number) => {
    setIsLoading(true);
    let successCount = 0;
    let rateLimitedCount = 0;

    try {
      for (let i = 0; i < count; i++) {
        const { data, error } = await supabase.rpc('check_rate_limit', {
          p_endpoint: endpoint
        });

        if (error) throw error;

        const rateLimitInfo = data as any;
        if (rateLimitInfo.allowed) {
          successCount++;
        } else {
          rateLimitedCount++;
          setRateLimitStatus({ endpoint, ...rateLimitInfo });
          break; // Stop on first rate limit
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      toast({
        title: 'Burst Test Complete',
        description: `${successCount} successful, ${rateLimitedCount} rate limited`,
        variant: rateLimitedCount > 0 ? 'destructive' : 'default'
      });
    } catch (err) {
      console.error('Burst test error:', err);
      toast({
        title: 'Burst Test Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const status = rateLimitStatus ? getRateLimitStatus(rateLimitStatus) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldX className="h-5 w-5" />
          Rate Limiting Test
        </CardTitle>
        <CardDescription>
          Test rate limiting on admin APIs with per-user/IP tracking and exponential backoff
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {rateLimitStatus && (
          <Alert variant={rateLimitStatus.allowed ? 'default' : 'destructive'}>
            <BarChart3 className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span><strong>Endpoint:</strong> {rateLimitStatus.endpoint}</span>
                  <Badge variant={rateLimitStatus.allowed ? 'default' : 'destructive'}>
                    {rateLimitStatus.allowed ? 'Allowed' : 'Rate Limited'}
                  </Badge>
                </div>
                
                {status && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Usage: {status.current}/{status.limit}</span>
                      <span>{status.remaining} remaining</span>
                    </div>
                    <Progress value={status.percentUsed} className="h-2" />
                  </div>
                )}
                
                {!rateLimitStatus.allowed && (
                  <div className="mt-2 text-sm">
                    <p><strong>Reason:</strong> {rateLimitStatus.reason}</p>
                    {rateLimitStatus.backoff_level && (
                      <p><strong>Backoff Level:</strong> {rateLimitStatus.backoff_level}</p>
                    )}
                    {rateLimitStatus.retry_after_seconds && (
                      <p><strong>Retry After:</strong> {rateLimitStatus.retry_after_seconds} seconds</p>
                    )}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <h4 className="font-medium">Single Request Tests</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {testEndpoints.map((test) => (
              <Button
                key={test.endpoint}
                onClick={() => testRateLimit(test.endpoint)}
                disabled={isLoading}
                variant="outline"
                className="justify-between"
              >
                <span>{test.name}</span>
                <Badge variant="secondary">{test.limit}</Badge>
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium">Burst Tests (Trigger Rate Limiting)</h4>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => testMultipleRequests('suspend_organization', 15)}
              disabled={isLoading}
              variant="destructive"
              size="sm"
            >
              <Timer className="h-4 w-4 mr-1" />
              15x Suspend (10/min limit)
            </Button>
            <Button
              onClick={() => testMultipleRequests('verify_step_up_auth', 25)}
              disabled={isLoading}
              variant="destructive"
              size="sm"
            >
              25x Step-up Auth (20/min limit)
            </Button>
            <Button
              onClick={() => testMultipleRequests('admin_destructive_action', 8)}
              disabled={isLoading}
              variant="destructive"
              size="sm"
            >
              8x Destructive Action (5/min limit)
            </Button>
          </div>
        </div>

        <div className="p-3 bg-muted rounded-lg text-sm">
          <p><strong>Rate Limiting Features:</strong></p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Per-user/IP tracking with configurable limits</li>
            <li>Exponential backoff on repeated violations</li>
            <li>Security logging to internal audit channel</li>
            <li>429 responses with retry-after headers</li>
            <li>Automatic cleanup of old rate limit records</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}