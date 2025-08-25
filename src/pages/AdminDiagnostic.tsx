import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Copy, Eye, EyeOff, Shield, Database, CreditCard, Mail, ExternalLink, Settings, Lock, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { BUILD_ID, clearAllCaches, forceReload, getBuildInfo, getCosmenticEnvVars, type CacheClearResult } from '@/lib/build-info';

interface DiagnosticData {
  authUid: string | null;
  authEmail: string | null;
  dbSuperadminCheck: boolean | null;
  frontendEnv: string | null;
  finalGuardDecision: boolean | null;
  error?: string;
}

interface ApiProbeResult {
  name: string;
  method: string;
  url: string;
  fullUrl: string;
  status: number | null;
  responseBody: string;
  responseSnippet: string;
  headers: Record<string, string>;
  authHeaderSent: boolean;
  error?: string;
  timestamp: string;
}

interface SecretCheck {
  name: string;
  present: boolean;
  category: string;
  required: boolean;
  description?: string;
}

interface SecretsCheckResult {
  success: boolean;
  timestamp: string;
  summary: {
    total_checked: number;
    present: number;
    missing_required: number;
    missing_optional: number;
  };
  categorized: Record<string, SecretCheck[]>;
  missing_required: SecretCheck[];
  missing_optional: SecretCheck[];
  blocking_for_admin_apis: SecretCheck[];
}

interface StripeTestResult {
  test_name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

interface StripeSmokeTestResult {
  success: boolean;
  timestamp: string;
  results: StripeTestResult[];
  summary: {
    total_tests: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

export default function AdminDiagnostic() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData>({
    authUid: null,
    authEmail: null,
    dbSuperadminCheck: null,
    frontendEnv: null,
    finalGuardDecision: null,
  });
  const [apiProbeResults, setApiProbeResults] = useState<ApiProbeResult[]>([]);
  const [secretsResults, setSecretsResults] = useState<SecretsCheckResult | null>(null);
  const [stripeResults, setStripeResults] = useState<StripeSmokeTestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const [isCheckingSecrets, setIsCheckingSecrets] = useState(false);
  const [isCheckingStripe, setIsCheckingStripe] = useState(false);
  const [isCacheClearing, setIsCacheClearing] = useState(false);
  const [cacheResult, setCacheResult] = useState<CacheClearResult | null>(null);
  const [showAuthDetails, setShowAuthDetails] = useState(false);
  const [probeWithoutAuth, setProbeWithoutAuth] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const checkSecrets = async () => {
    try {
      setIsCheckingSecrets(true);
      const { data, error } = await supabase.functions.invoke('check-secrets');
      
      if (error) {
        console.error('Secrets check error:', error);
        toast({
          title: "Error checking secrets",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setSecretsResults(data);
      toast({
        title: "Secrets check completed",
        description: `Checked ${data.summary.total_checked} secrets`,
      });
    } catch (error) {
      console.error('Secrets check failed:', error);
      toast({
        title: "Secrets check failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCheckingSecrets(false);
    }
  };

  const checkStripeConnectivity = async () => {
    try {
      setIsCheckingStripe(true);
      const { data, error } = await supabase.functions.invoke('stripe-smoke-test');
      
      if (error) {
        console.error('Stripe smoke test error:', error);
        toast({
          title: "Error checking Stripe connectivity",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setStripeResults(data);
      toast({
        title: "Stripe smoke test completed",
        description: `Ran ${data.summary.total_tests} tests: ${data.summary.passed} passed, ${data.summary.failed} failed, ${data.summary.warnings} warnings`,
        variant: data.summary.failed > 0 ? "destructive" : "default",
      });
    } catch (error) {
      console.error('Stripe smoke test failed:', error);
      toast({
        title: "Stripe smoke test failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCheckingStripe(false);
    }
  };

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      let dbCheck: boolean | null = null;
      let guardDecision: boolean | null = null;
      let error: string | undefined;

      if (currentUser) {
        try {
          // Test DB RPC call - Source of truth for superadmin status
          const { data: isSuperadmin, error: rpcError } = await supabase.rpc('is_superadmin');
          
          if (rpcError) {
            error = `DB RPC Error: ${rpcError.message}`;
            dbCheck = null;
          } else {
            dbCheck = Boolean(isSuperadmin);
          }

          // Simulate the final guard decision logic
          guardDecision = dbCheck;
        } catch (err) {
          error = `Exception in diagnostics: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      setDiagnosticData({
        authUid: currentUser?.id || null,
        authEmail: currentUser?.email || null,
        dbSuperadminCheck: dbCheck,
        frontendEnv: getCosmenticEnvVars().frontend, // Cosmetic only - not used for auth
        finalGuardDecision: guardDecision,
        error
      });
    } catch (err) {
      setDiagnosticData(prev => ({
        ...prev,
        error: `Diagnostic error: ${err instanceof Error ? err.message : String(err)}`
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const runApiProbes = async (withoutAuth = false) => {
    setIsProbing(true);
    const probes: ApiProbeResult[] = [];
    const timestamp = new Date().toISOString();

    // Define all admin APIs used by the admin UI
    const adminApis = [
      { name: 'Admin Billing Overview - Subscriptions', method: 'POST', function: 'admin-billing-overview', body: { action: 'list_subscriptions' } },
      { name: 'Admin Billing Overview - Invoices', method: 'POST', function: 'admin-billing-overview', body: { action: 'list_invoices' } },
      { name: 'Admin Billing Overview - Webhooks', method: 'POST', function: 'admin-billing-overview', body: { action: 'list_webhook_events' } },
      { name: 'Admin Billing Actions - Portal', method: 'POST', function: 'admin-billing-actions', body: { action: 'create_portal_session', customer_id: 'test' } },
      { name: 'Admin Billing Actions - Sync Subscription', method: 'POST', function: 'admin-billing-actions', body: { action: 'sync_subscription', subscription_id: 'test' } },
      { name: 'Admin Billing Actions - Cancel Subscription', method: 'POST', function: 'admin-billing-actions', body: { action: 'cancel_subscription', subscription_id: 'test' } },
      { name: 'Org Suspension - Suspend', method: 'POST', function: 'org-suspension', body: { action: 'suspend', org_id: 'test-org-id', reason: 'Test probe', confirmation_phrase: 'SUSPEND ORG test-org-id' } },
      { name: 'Data Fixes', method: 'POST', function: 'admin-data-fixes', body: { action: 'test_probe' } },
      { name: 'Email Integration Test', method: 'POST', function: 'send-test-email', body: { to: 'test@example.com', subject: 'Probe Test' } },
    ];

    for (const api of adminApis) {
      try {
        // Get Supabase function URL from environment
        const baseUrl = import.meta.env.VITE_SUPABASE_URL;
        const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const fullUrl = `${baseUrl}/functions/v1/${api.function}`;
        
        // Make direct fetch to capture full response details
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'x-client-info': 'supabase-js-web/2.55.0',
          'apikey': apiKey
        };
        
        let authHeaderSent = false;
        if (!withoutAuth) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
            authHeaderSent = true;
          }
        }

        const response = await fetch(fullUrl, {
          method: api.method,
          headers,
          body: JSON.stringify(api.body)
        });

        // Extract response details
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        let responseBody = '';
        let responseSnippet = '';
        try {
          responseBody = await response.text();
          responseSnippet = responseBody.substring(0, 1000);
        } catch {
          responseBody = 'Failed to read response body';
          responseSnippet = responseBody;
        }

        probes.push({
          name: api.name,
          method: api.method,
          url: api.function,
          fullUrl,
          status: response.status,
          responseBody,
          responseSnippet,
          headers: responseHeaders,
          authHeaderSent,
          timestamp,
          error: response.ok ? undefined : `HTTP ${response.status}`
        });
      } catch (err) {
        const baseUrl = import.meta.env.VITE_SUPABASE_URL;
        const fullUrl = `${baseUrl}/functions/v1/${api.function}`;
        
        probes.push({
          name: api.name,
          method: api.method,
          url: api.function,
          fullUrl,
          status: null,
          responseBody: `Exception: ${err instanceof Error ? err.message : String(err)}`,
          responseSnippet: `Exception: ${err instanceof Error ? err.message : String(err)}`,
          headers: {},
          authHeaderSent: !withoutAuth,
          timestamp,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    setApiProbeResults(probes);
    setIsProbing(false);
  };

  const handleCacheClear = async () => {
    setIsCacheClearing(true);
    setCacheResult(null);
    
    try {
      const result = await clearAllCaches();
      setCacheResult(result);
      
      if (result.success) {
        // Show success message and prompt reload
        setTimeout(() => {
          if (confirm(
            `Cache cleared successfully!\n\n` +
            `Service Workers: ${result.serviceWorkersCleared} unregistered\n` +
            `Caches: ${result.cachesCleared.length} cleared\n\n` +
            `Click OK to reload and load fresh code.`
          )) {
            forceReload();
          }
        }, 500);
      }
    } catch (error) {
      setCacheResult({
        serviceWorkersCleared: 0,
        cachesCleared: [],
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsCacheClearing(false);
    }
  };

  const handleRecheck = async () => {
    await runDiagnostics();
    await runApiProbes(probeWithoutAuth);
  };

  const copyDiagnostics = async () => {
    const diagnosticsText = `
# Admin Diagnostic Report
Generated: ${new Date().toISOString()}
Build ID: ${BUILD_ID}

## Authentication Session
- User ID: ${diagnosticData.authUid || 'Not authenticated'}
- Email: ${diagnosticData.authEmail || 'Not available'}

## Database RPC Check
- Result: ${diagnosticData.dbSuperadminCheck !== null ? String(diagnosticData.dbSuperadminCheck) : 'Error/Unknown'}

## Environment Variables (Cosmetic)
- Frontend: ${diagnosticData.frontendEnv || 'Not set'}

## Final Decision
- Access Granted: ${diagnosticData.finalGuardDecision !== null ? String(diagnosticData.finalGuardDecision) : 'Unknown'}

## API Probe Results
Auth Headers: ${probeWithoutAuth ? 'Disabled' : 'Enabled'}
${apiProbeResults.map(result => `
### ${result.name}
- Method: ${result.method}
- URL: ${result.fullUrl}
- Status: ${result.status || 'Error'}
- Auth Header Sent: ${result.authHeaderSent}
- Headers: ${JSON.stringify(result.headers, null, 2)}
- Response Body (first 1000 chars):
${result.responseBody}
`).join('\n')}

## Build Information
- Build ID: ${BUILD_ID}
- User Agent: ${navigator.userAgent}
- Cache API: ${('caches' in window) ? 'Available' : 'Not Available'}
- Service Worker: ${('serviceWorker' in navigator) ? 'Available' : 'Not Available'}
`.trim();

    try {
      await navigator.clipboard.writeText(diagnosticsText);
      alert('Diagnostics copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback: create a text area and select it
      const textArea = document.createElement('textarea');
      textArea.value = diagnosticsText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Diagnostics copied to clipboard!');
    }
  };

  const copySecretsResults = () => {
    if (!secretsResults) return;
    
    const diagnosticsText = `SECRETS DIAGNOSTICS
Generated: ${secretsResults.timestamp}

SUMMARY:
- Total Checked: ${secretsResults.summary.total_checked}
- Present: ${secretsResults.summary.present}
- Missing Required: ${secretsResults.summary.missing_required}
- Missing Optional: ${secretsResults.summary.missing_optional}

BLOCKING FOR ADMIN APIS:
${secretsResults.blocking_for_admin_apis.length > 0 
  ? secretsResults.blocking_for_admin_apis.map(s => `❌ ${s.name} - ${s.description}`).join('\n')
  : '✅ No blocking secrets missing'
}

MISSING REQUIRED SECRETS:
${secretsResults.missing_required.length > 0 
  ? secretsResults.missing_required.map(s => `❌ ${s.name} (${s.category}) - ${s.description}`).join('\n')
  : '✅ All required secrets present'
}

BY CATEGORY:
${Object.entries(secretsResults.categorized).map(([category, secrets]) => 
  `${category}:\n${secrets.map(s => `  ${s.present ? '✅' : '❌'} ${s.name}${s.required ? ' (required)' : ''}`).join('\n')}`
).join('\n\n')}
`;

    navigator.clipboard.writeText(diagnosticsText);
    toast({
      title: "Copied to clipboard",
      description: "Secrets diagnostics copied to clipboard",
    });
  };

  const toggleRowExpansion = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const getStripeValidationForEndpoint = (endpointName: string): string | null => {
    if (!stripeResults) return null;
    
    // Map billing endpoints to Stripe test results
    const endpointMapping: Record<string, string> = {
      'Admin Billing Overview - Subscriptions': 'Subscription Operations',
      'Admin Billing Overview - Invoices': 'Invoice Operations', 
      'Admin Billing Overview - Webhooks': 'Webhook Events Access',
      'Admin Billing Actions - Portal': 'Billing Portal Session Creation',
      'Admin Billing Actions - Sync Subscription': 'Subscription Operations',
      'Admin Billing Actions - Cancel Subscription': 'Subscription Operations'
    };
    
    const stripeTestName = endpointMapping[endpointName];
    if (!stripeTestName) return null;
    
    const stripeTest = stripeResults.results.find(test => test.test_name === stripeTestName);
    if (!stripeTest) return null;
    
    const statusEmoji = stripeTest.status === 'pass' ? '✅' : stripeTest.status === 'fail' ? '❌' : '⚠️';
    return `${statusEmoji} ${stripeTest.status}`;
  };

  useEffect(() => {
    const initializeChecks = async () => {
      await runDiagnostics();
      await checkSecrets();
      await checkStripeConnectivity();
      // Only run API probes in development mode for security
      if (import.meta.env.DEV) {
        await runApiProbes(probeWithoutAuth);
      }
    };
    
    initializeChecks();
  }, []);

  const StatusIcon = ({ status }: { status: boolean | null }) => {
    if (status === null) return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    return status ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />;
  };

  const StatusBadge = ({ status }: { status: boolean | null }) => {
    if (status === null) return <Badge variant="secondary">Unknown</Badge>;
    return status ? <Badge variant="default" className="bg-green-500">Pass</Badge> : <Badge variant="destructive">Fail</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Diagnostic</h1>
            <p className="text-muted-foreground">
              Diagnosing superadmin authorization flow • Build ID: <code className="bg-muted px-1 rounded text-sm">{BUILD_ID}</code>
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRecheck} disabled={isLoading || isProbing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${(isLoading || isProbing) ? 'animate-spin' : ''}`} />
              Re-check All
            </Button>
            <Button 
              onClick={handleCacheClear} 
              disabled={isCacheClearing}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isCacheClearing ? 'animate-spin' : ''}`} />
              Hard Refresh Cache
            </Button>
            <Button 
              onClick={copyDiagnostics} 
              variant="outline"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Diagnostics
            </Button>
          </div>
        </div>

        {diagnosticData.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {diagnosticData.error}
            </AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Source of truth = DB (public.superadmins + GUC fallback inside is_superadmin). Env checks are cosmetic only.</strong>
          </AlertDescription>
        </Alert>

        {/* Secrets Checklist Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Secrets Checklist
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={checkSecrets}
                  disabled={isCheckingSecrets}
                  variant="outline"
                  size="sm"
                >
                  {isCheckingSecrets ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </>
                  )}
                </Button>
                {secretsResults && (
                  <Button
                    onClick={copySecretsResults}
                    variant="outline"
                    size="sm"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Results
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!secretsResults ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading secrets checklist...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{secretsResults.summary.total_checked}</div>
                    <div className="text-sm text-muted-foreground">Total Checked</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{secretsResults.summary.present}</div>
                    <div className="text-sm text-muted-foreground">Present</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{secretsResults.summary.missing_required}</div>
                    <div className="text-sm text-muted-foreground">Missing Required</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{secretsResults.summary.missing_optional}</div>
                    <div className="text-sm text-muted-foreground">Missing Optional</div>
                  </div>
                </div>

                {/* Blocking for Admin APIs */}
                {secretsResults.blocking_for_admin_apis.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Blocking for Admin APIs</AlertTitle>
                    <AlertDescription>
                      The following required secrets are missing and may cause 500 errors:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        {secretsResults.blocking_for_admin_apis.map((secret) => (
                          <li key={secret.name}>
                            <strong>{secret.name}</strong> - {secret.description}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Missing Required Secrets */}
                {secretsResults.missing_required.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Missing Required Secrets</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1">
                        {secretsResults.missing_required.map((secret) => (
                          <li key={secret.name}>
                            <strong>{secret.name}</strong> ({secret.category}) - {secret.description}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Secrets by Category */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Secrets by Category</h3>
                  {Object.entries(secretsResults.categorized).map(([category, secrets]) => (
                    <div key={category} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        {category === 'Stripe' && <CreditCard className="h-4 w-4" />}
                        {category === 'Supabase' && <Database className="h-4 w-4" />}
                        {category === 'Email' && <Mail className="h-4 w-4" />}
                        {category === 'Admin' && <Shield className="h-4 w-4" />}
                        {category === 'External' && <ExternalLink className="h-4 w-4" />}
                        {category === 'Environment' && <Settings className="h-4 w-4" />}
                        {category === 'Security' && <Lock className="h-4 w-4" />}
                        {category}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {secrets.map((secret) => (
                          <div key={secret.name} className="flex items-center gap-2 text-sm">
                            {secret.present ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className={secret.required ? 'font-medium' : ''}>
                              {secret.name}
                              {secret.required && <span className="text-red-600 ml-1">*</span>}
                            </span>
                            {secret.description && (
                              <span className="text-muted-foreground text-xs">
                                - {secret.description}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground">
                  * Required secrets. Missing required secrets may cause functionality to fail.
                  <br />
                  Last checked: {new Date(secretsResults.timestamp).toLocaleString()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stripe Connectivity Tests Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Stripe Connectivity Tests
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={checkStripeConnectivity}
                  disabled={isCheckingStripe}
                  variant="outline"
                  size="sm"
                >
                  {isCheckingStripe ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Run Tests
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!stripeResults ? (
              <div className="text-center py-8">
                <CreditCard className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                <p>Click "Run Tests" to check Stripe connectivity and configuration</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{stripeResults.summary.total_tests}</div>
                    <div className="text-sm text-muted-foreground">Total Tests</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{stripeResults.summary.passed}</div>
                    <div className="text-sm text-muted-foreground">Passed</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{stripeResults.summary.failed}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{stripeResults.summary.warnings}</div>
                    <div className="text-sm text-muted-foreground">Warnings</div>
                  </div>
                </div>

                {/* Test Results */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Test Results</h3>
                  {stripeResults.results.map((test, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        {test.status === 'pass' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : test.status === 'fail' ? (
                          <XCircle className="h-5 w-5 text-red-600" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        )}
                        <span className="font-medium">{test.test_name}</span>
                        <Badge 
                          variant={test.status === 'pass' ? "default" : test.status === 'fail' ? "destructive" : "secondary"}
                          className={test.status === 'pass' ? "bg-green-500" : test.status === 'warning' ? "bg-yellow-500" : ""}
                        >
                          {test.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{test.message}</p>
                      {test.details && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View details</summary>
                          <pre className="mt-2 bg-muted p-2 rounded overflow-x-auto">
                            {JSON.stringify(test.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground">
                  Last tested: {new Date(stripeResults.timestamp).toLocaleString()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StatusIcon status={!!diagnosticData.authUid} />
                Authentication Session
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">User ID:</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {diagnosticData.authUid || 'Not authenticated'}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Email:</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {diagnosticData.authEmail || 'Not available'}
                </code>
        </div>

        {cacheResult && (
          <Alert variant={cacheResult.success ? "default" : "destructive"}>
            <RefreshCw className="h-4 w-4" />
            <AlertDescription>
              {cacheResult.success ? (
                <>
                  <strong>Cache cleared successfully!</strong><br />
                  Service Workers: {cacheResult.serviceWorkersCleared} unregistered<br />
                  Caches: {cacheResult.cachesCleared.length} cleared ({cacheResult.cachesCleared.join(', ')})
                </>
              ) : (
                <>
                  <strong>Cache clear failed:</strong> {cacheResult.error}
                </>
              )}
            </AlertDescription>
          </Alert>
        )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StatusIcon status={diagnosticData.dbSuperadminCheck} />
                Database RPC Check (is_superadmin)
                <StatusBadge status={diagnosticData.dbSuperadminCheck} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between">
                <span className="font-medium">Result:</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {diagnosticData.dbSuperadminCheck !== null ? String(diagnosticData.dbSuperadminCheck) : 'Error/Unknown'}
                </code>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                This is the authoritative source for superadmin status. Checks public.superadmins table first, then GUC app.superadmin_emails as fallback.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Environment Variables (Cosmetic Only - Never Used for Auth)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>CRITICAL:</strong> These environment variables are NEVER used for authorization decisions. 
                  Source of truth = DB RPC only.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">VITE_SUPERADMINS_EMAILS (Frontend):</span>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {diagnosticData.frontendEnv || 'Not set'}
                  </code>
                </div>
                
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                  <p><strong>Note:</strong> Server-side env vars (SUPERADMINS_EMAILS, superadmins_emails) are not accessible from client-side code.</p>
                  <p><strong>Policy:</strong> All env vars are for UI hints and logging only. Authorization always uses <code>supabase.rpc('is_superadmin')</code>.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StatusIcon status={diagnosticData.finalGuardDecision} />
                Final Guard Decision
                <StatusBadge status={diagnosticData.finalGuardDecision} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between">
                <span className="font-medium">Access Granted:</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {diagnosticData.finalGuardDecision !== null ? String(diagnosticData.finalGuardDecision) : 'Unknown'}
                </code>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                This should match the DB RPC check result exactly. If it doesn't, there's a logic error in the guard.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {diagnosticData.finalGuardDecision === true ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  ✅ All checks pass. You should have access to /admin.
                </AlertDescription>
              </Alert>
            ) : diagnosticData.finalGuardDecision === false ? (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  ❌ Access denied. DB reports you are not a superadmin.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  ⚠️ Cannot determine access status due to errors above.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Admin API Probe
              {isProbing && <RefreshCw className="h-4 w-4 animate-spin" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Testing all admin APIs. All should return 200 for superadmins, 403 for non-superadmins.
              </p>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch 
                    id="probe-without-auth"
                    checked={probeWithoutAuth}
                    onCheckedChange={setProbeWithoutAuth}
                  />
                  <label htmlFor="probe-without-auth" className="text-sm">
                    Probe without Authorization header (expect 403s)
                  </label>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch 
                    id="show-auth-details"
                    checked={showAuthDetails}
                    onCheckedChange={setShowAuthDetails}
                  />
                  <label htmlFor="show-auth-details" className="text-sm">
                    Show detailed headers
                  </label>
                </div>
              </div>
            </div>
            
            {apiProbeResults.length > 0 ? (
              <div className="overflow-x-auto mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>API Endpoint</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Auth</TableHead>
                      <TableHead>Response</TableHead>
                      {showAuthDetails && <TableHead>Headers</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiProbeResults.map((result, index) => (
                      <>
                        <TableRow key={index} className="cursor-pointer" onClick={() => toggleRowExpansion(index)}>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                              {expandedRows.has(index) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            <div className="space-y-1">
                              <div>{result.name}</div>
                              {getStripeValidationForEndpoint(result.name) && (
                                <div className="text-xs text-muted-foreground">
                                  Stripe: {getStripeValidationForEndpoint(result.name)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{result.method}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                result.status === 200 ? "default" : 
                                result.status === 403 ? "destructive" : 
                                "secondary"
                              }
                              className={
                                result.status === 200 ? "bg-green-500" :
                                result.status === 403 ? "" :
                                "bg-yellow-500"
                              }
                            >
                              {result.status || 'Error'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={result.authHeaderSent ? "default" : "outline"}>
                              {result.authHeaderSent ? "Sent" : "None"}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <code className="text-xs bg-muted px-2 py-1 rounded break-all">
                              {result.responseSnippet.substring(0, 100)}
                              {result.responseSnippet.length > 100 && '...'}
                            </code>
                          </TableCell>
                          {showAuthDetails && (
                            <TableCell className="max-w-xs">
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {Object.keys(result.headers).length} headers
                                {result.headers['x-request-id'] && ` • ${result.headers['x-request-id'].substring(0, 8)}...`}
                              </code>
                            </TableCell>
                          )}
                        </TableRow>
                        {expandedRows.has(index) && (
                          <TableRow key={`${index}-expanded`}>
                            <TableCell colSpan={showAuthDetails ? 7 : 6} className="bg-muted/30">
                              <div className="space-y-3 p-3">
                                <div>
                                  <strong className="text-sm">Full URL:</strong>
                                  <code className="block text-xs bg-muted px-2 py-1 rounded mt-1 break-all">
                                    {result.fullUrl}
                                  </code>
                                </div>
                                
                                <div>
                                  <strong className="text-sm">Response Headers:</strong>
                                  <pre className="text-xs bg-muted px-2 py-1 rounded mt-1 overflow-x-auto">
                                    {JSON.stringify(result.headers, null, 2)}
                                  </pre>
                                </div>
                                
                                <div>
                                  <strong className="text-sm">Response Body (first 1000 chars):</strong>
                                  <pre className="text-xs bg-muted px-2 py-1 rounded mt-1 overflow-x-auto whitespace-pre-wrap">
                                    {result.responseBody}
                                  </pre>
                                </div>
                                
                                <div className="text-xs text-muted-foreground">
                                  Timestamp: {result.timestamp}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                {isProbing ? 'Probing admin APIs...' : 'No probe results yet'}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button 
                onClick={() => runApiProbes(probeWithoutAuth)} 
                disabled={isProbing}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isProbing ? 'animate-spin' : ''}`} />
                Re-probe APIs
              </Button>
              
              {apiProbeResults.length > 0 && (
                <Button 
                  onClick={copyDiagnostics}
                  variant="outline"
                  size="sm"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Results
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Build Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="font-medium">Build ID:</span>
              <code className="text-sm bg-muted px-2 py-1 rounded">{BUILD_ID}</code>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">User Agent:</span>
              <code className="text-sm bg-muted px-2 py-1 rounded max-w-xs truncate">
                {navigator.userAgent}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Cache API Support:</span>
              <Badge variant={('caches' in window) ? "default" : "secondary"}>
                {('caches' in window) ? 'Available' : 'Not Available'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Service Worker Support:</span>
              <Badge variant={('serviceWorker' in navigator) ? "default" : "secondary"}>
                {('serviceWorker' in navigator) ? 'Available' : 'Not Available'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}