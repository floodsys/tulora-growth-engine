import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Loader2, RefreshCw, AlertTriangle, CreditCard } from 'lucide-react';
import { useUserOrganization } from '@/hooks/useUserOrganization';

interface PriceVerificationResult {
  plan_key: string;
  price_id: string;
  ok: boolean;
  error?: string;
}

interface VerificationResponse {
  mode: 'live' | 'test';
  results: PriceVerificationResult[];
  summary: {
    total: number;
    verified: number;
    failed: number;
  };
}

export function AdminBillingDiagnostics() {
  const [verification, setVerification] = useState<VerificationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { organization } = useUserOrganization();

  const runVerification = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-billing-verify-prices');

      if (error) throw error;
      setVerification(data);
      
      toast({
        title: "Price Verification Complete",
        description: `Verified ${data.summary.verified}/${data.summary.total} price IDs`,
      });
    } catch (error) {
      console.error('Error running price verification:', error);
      toast({
        title: "Error",
        description: "Failed to verify price IDs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-run verification on mount
  useEffect(() => {
    runVerification();
  }, []);

  const failedResults = verification?.results.filter(r => !r.ok) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Billing Diagnostics</h2>
          <p className="text-muted-foreground">
            Verify Stripe price configurations and mode compatibility
          </p>
        </div>
        <Button onClick={runVerification} disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <RefreshCw className="w-4 h-4 mr-2" />
          Re-run Checks
        </Button>
      </div>

      {/* Current Organization & Stripe Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Current Context
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Organization</label>
              <div className="p-2 bg-muted rounded">
                <div className="font-mono text-sm">{organization?.name || 'Not selected'}</div>
                <div className="text-xs text-muted-foreground">{organization?.id || 'N/A'}</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Stripe Mode</label>
              <div className="p-2 bg-muted rounded">
                {verification ? (
                  <Badge variant={verification.mode === 'live' ? 'default' : 'secondary'}>
                    {verification.mode} mode
                  </Badge>
                ) : (
                  <Badge variant="outline">Loading...</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Price Verification Results */}
      {verification && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Verification Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{verification.summary.total}</div>
                  <div className="text-sm text-muted-foreground">Total Prices</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{verification.summary.verified}</div>
                  <div className="text-sm text-muted-foreground">Verified</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{verification.summary.failed}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warnings for mismatches */}
          {failedResults.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">
                    {failedResults.length} price ID{failedResults.length !== 1 ? 's' : ''} failed verification
                  </p>
                  <p>
                    Fix the following plans in <strong>Admin → Stripe Configuration</strong>:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {failedResults.map((result) => (
                      <li key={result.plan_key} className="text-sm">
                        <strong>{result.plan_key}</strong>: {result.price_id}
                      </li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Detailed Results Table */}
          <Card>
            <CardHeader>
              <CardTitle>Price ID Verification Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {verification.results.map((result) => (
                  <div 
                    key={`${result.plan_key}-${result.price_id}`}
                    className={`flex items-center justify-between p-3 border rounded-lg ${
                      result.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {result.ok ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <div>
                        <div className="font-medium">{result.plan_key}</div>
                        <div className="text-sm font-mono text-muted-foreground">
                          {result.price_id}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {result.ok ? (
                        <Badge variant="default">OK</Badge>
                      ) : (
                        <div className="space-y-1">
                          <Badge variant="destructive">Failed</Badge>
                          {result.error && (
                            <div className="text-xs text-red-600 max-w-xs">
                              {result.error}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {verification.results.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No price IDs configured in plan_configs table
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}