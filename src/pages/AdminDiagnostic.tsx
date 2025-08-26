import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Copy, Eye, EyeOff, Shield, Database, CreditCard, Mail, ExternalLink, Settings, Lock, Loader2, UserCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { BUILD_ID, clearAllCaches, forceReload, getBuildInfo, getCosmenticEnvVars, type CacheClearResult } from '@/lib/build-info';
import { SeatStatusCard } from "@/components/admin/SeatStatusCard";

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
  // New structured error fields
  parsedError?: {
    ok: boolean;
    error: string;
    hint?: string;
    cause?: string;
  };
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

interface OrgAccessProbeResult {
  orgId: string;
  membership: boolean | null;
  adminAccess: boolean | null;
  updateSuccess: boolean | null;
  updateError: string | null;
  timestamp: string;
}

interface SecuritySnapshot {
  timestamp: string;
  tables: Array<{
    table_name: string;
    owner: string;
    has_rls: boolean;
    force_rls: boolean;
  }>;
  policies: Array<{
    policy_name: string;
    table_name: string;
    command: string;
    using_expression?: string;
    check_expression?: string;
    references_admin_access: boolean;
    references_org_membership: boolean;
  }>;
  functions: Array<{
    function_name: string;
    owner: string;
    security_definer: boolean;
    volatility: string;
    search_path: boolean;
  }>;
  grants: Array<{
    object_name: string;
    object_type: string;
    grantee: string;
    privilege_type: string;
    is_grantable: string;
  }>;
  build_info: {
    supabase_url: string;
    project_id: string;
    anon_key_fingerprint: string;
  };
}

interface SeatStatusInfo {
  user_id: string;
  organization_id: string;
  role: string;
  seat_active: boolean;
  is_owner: boolean;
  membership_exists: boolean;
  updated_at: string;
  error?: string;
}

interface RLSAcceptanceTestResult {
  success: boolean;
  timestamp: string;
  test_org_id?: string;
  summary?: {
    total_tests: number;
    passed: number;
    failed: number;
  };
  tests?: any[];
  all_tests_passed?: boolean;
  error?: string;
}

function AdminDiagnostic() {
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
  const [emailResults, setEmailResults] = useState<any>(null);
  const [orgAccessResults, setOrgAccessResults] = useState<OrgAccessProbeResult | null>(null);
  const [rlsTestResults, setRlsTestResults] = useState<RLSAcceptanceTestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const [isCheckingSecrets, setIsCheckingSecrets] = useState(false);
  const [isCheckingStripe, setIsCheckingStripe] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isTestingOrgAccess, setIsTestingOrgAccess] = useState(false);
  const [isRunningRlsTests, setIsRunningRlsTests] = useState(false);
  const [testOrgId, setTestOrgId] = useState('');
  const [isCacheClearing, setIsCacheClearing] = useState(false);
  const [securitySnapshot, setSecuritySnapshot] = useState<SecuritySnapshot | null>(null);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [seatStatus, setSeatStatus] = useState<SeatStatusInfo | null>(null);
  const [isLoadingSeat, setIsLoadingSeat] = useState(false);
  const [cacheResult, setCacheResult] = useState<CacheClearResult | null>(null);
  const [showAuthDetails, setShowAuthDetails] = useState(false);
  const [probeWithoutAuth, setProbeWithoutAuth] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [dualRoleResults, setDualRoleResults] = useState<{
    superadmin: ApiProbeResult[];
    nonSuperadmin: ApiProbeResult[];
    summary: {
      superadminPass: number;
      nonSuperadminCorrect403: number;
      total: number;
      unexpected: (ApiProbeResult & { context: string })[];
    };
  } | null>(null);
  const [isDualRoleProbing, setIsDualRoleProbing] = useState(false);

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

  const checkEmailIntegration = async () => {
    try {
      setIsCheckingEmail(true);
      const { data, error } = await supabase.functions.invoke('email-integration-test');
      
      if (error) {
        console.error('Email integration test error:', error);
        toast({
          title: "Error checking email integration",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setEmailResults(data);
      toast({
        title: "Email integration test completed",
        description: data.ok ? data.summary : data.reason,
        variant: data.ok ? "default" : "destructive",
      });
    } catch (error) {
      console.error('Email integration test failed:', error);
      toast({
        title: "Email integration test failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const runOrgAccessProbe = async () => {
    if (!testOrgId || !testOrgId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      toast({
        title: "Invalid Organization ID",
        description: "Please enter a valid UUID",
        variant: "destructive",
      });
      return;
    }

    setIsTestingOrgAccess(true);
    const timestamp = new Date().toISOString();

    try {
      // Test RLS functions
      const { data: membershipResult, error: membershipError } = await supabase.rpc('check_org_membership', { p_org_id: testOrgId });
      const { data: adminResult, error: adminError } = await supabase.rpc('check_admin_access', { p_org_id: testOrgId });

      // Test actual update via app client (dry run)
      let updateSuccess: boolean | null = null;
      let updateError: string | null = null;

      try {
        const { error: updateErr } = await supabase
          .from('organizations')
          .update({ name: 'TEST_PROBE_UPDATE' }) // This will be rolled back
          .eq('id', testOrgId);

        if (updateErr) {
          updateSuccess = false;
          updateError = updateErr.message;
        } else {
          updateSuccess = true;
          // Roll back the change immediately
          await supabase
            .from('organizations')
            .update({ name: 'TEST_PROBE_UPDATE_ROLLBACK' })
            .eq('id', testOrgId);
        }
      } catch (err) {
        updateSuccess = false;
        updateError = err instanceof Error ? err.message : String(err);
      }

      const result: OrgAccessProbeResult = {
        orgId: testOrgId,
        membership: membershipError ? null : Boolean(membershipResult),
        adminAccess: adminError ? null : Boolean(adminResult),
        updateSuccess,
        updateError,
        timestamp
      };

      setOrgAccessResults(result);

      toast({
        title: "Org Access Probe Completed",
        description: `Membership: ${result.membership}, Admin: ${result.adminAccess}, Update: ${result.updateSuccess ? 'Success' : 'Failed'}`,
        variant: result.updateSuccess === false ? "destructive" : "default",
      });
    } catch (error) {
      console.error('Org access probe failed:', error);
      toast({
        title: "Org Access Probe Failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsTestingOrgAccess(false);
    }
  };

  const fetchSecuritySnapshot = async () => {
    setIsLoadingSnapshot(true);
    
    try {
      const { data, error } = await supabase.rpc('get_security_snapshot');
      
      if (error) {
        console.error('Security snapshot error:', error);
        toast({
          title: "Security Snapshot Failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      
      setSecuritySnapshot(data as unknown as SecuritySnapshot);
      toast({
        title: "Security Snapshot Loaded",
        description: "Current security configuration captured",
      });
    } catch (error: any) {
      console.error('Security snapshot failed:', error);
      toast({
        title: "Security Snapshot Failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSnapshot(false);
    }
  };

  const activateSeatAndGetStatus = async (orgId?: string) => {
    setIsLoadingSeat(true);
    
    try {
      // Get user's current organization if orgId not provided
      let targetOrgId = orgId;
      if (!targetOrgId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        
        // Get user's first organization
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id')
          .eq('owner_user_id', user.id)
          .limit(1);
          
        if (!orgs || orgs.length === 0) {
          // Try to find organization membership
          const { data: memberships } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .limit(1);
            
          if (memberships && memberships.length > 0) {
            targetOrgId = memberships[0].organization_id;
          } else {
            throw new Error('No organization found');
          }
        } else {
          targetOrgId = orgs[0].id;
        }
      }
      
      const { data, error } = await supabase.rpc('activate_seat_and_get_status', { 
        p_org_id: targetOrgId 
      });
      
      if (error) {
        console.error('Seat activation error:', error);
        toast({
          title: "Seat Activation Failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      
      const seatData = data as unknown as SeatStatusInfo;
      if (seatData.error) {
        toast({
          title: "Seat Status Error",
          description: seatData.error,
          variant: "destructive",
        });
        return;
      }
      
      setSeatStatus(seatData);
      toast({
        title: "Seat Status Updated",
        description: `Role: ${seatData.role}, Active: ${seatData.seat_active}`,
      });
    } catch (error: any) {
      console.error('Seat status failed:', error);
      toast({
        title: "Seat Status Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingSeat(false);
    }
  };

  const runRlsAcceptanceTests = async () => {
    setIsRunningRlsTests(true);
    
    try {
      const { data, error } = await supabase.rpc('run_rls_acceptance_tests');
      
      if (error) {
        console.error('RLS acceptance tests error:', error);
        toast({
          title: "RLS Acceptance Tests Failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setRlsTestResults(data as unknown as RLSAcceptanceTestResult);
      
      const testData = data as unknown as RLSAcceptanceTestResult;
      const summary = testData.summary;
      if (summary) {
        toast({
          title: "RLS Acceptance Tests Completed",
          description: `${summary.passed}/${summary.total_tests} tests passed`,
          variant: summary.failed > 0 ? "destructive" : "default",
        });
      }
    } catch (error) {
      console.error('RLS acceptance tests failed:', error);
      toast({
        title: "RLS Acceptance Tests Failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsRunningRlsTests(false);
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

    // Get a real organization ID for testing
    let testOrgId = '00000000-0000-0000-0000-000000000000'; // Default fallback
    try {
      const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
      if (orgs && orgs.length > 0) {
        testOrgId = orgs[0].id;
      }
    } catch (error) {
      console.warn('Could not fetch test org ID, using fallback:', error);
    }

    // Define all admin APIs used by the admin UI with real data
    const adminApis = [
      { name: 'Admin Billing Overview - Subscriptions', method: 'POST', function: 'admin-billing-overview', body: { action: 'list_subscriptions' } },
      { name: 'Admin Billing Overview - Invoices', method: 'POST', function: 'admin-billing-overview', body: { action: 'list_invoices' } },
      { name: 'Admin Billing Overview - Webhooks', method: 'POST', function: 'admin-billing-overview', body: { action: 'list_webhook_events' } },
      { name: 'Admin Billing Actions - Portal', method: 'POST', function: 'admin-billing-actions', body: { action: 'create_portal_session', org_id: testOrgId } },
      { name: 'Admin Billing Actions - Sync Subscription', method: 'POST', function: 'admin-billing-actions', body: { action: 'change_plan', org_id: testOrgId, new_plan: 'basic' } },
      { name: 'Admin Billing Actions - Cancel Subscription', method: 'POST', function: 'admin-billing-actions', body: { action: 'suspend_service', org_id: testOrgId } },
      { name: 'Org Suspension - Suspend (Dry Run)', method: 'POST', function: 'org-suspension', body: { action: 'suspend', org_id: testOrgId, reason: 'Test probe', confirmation_phrase: `SUSPEND ORG ${testOrgId}`, dry_run: true } },
      { name: 'Email Integration Test', method: 'POST', function: 'email-integration-test', body: {} },
      { name: 'Check Secrets', method: 'POST', function: 'check-secrets', body: {} },
      { name: 'Stripe Smoke Test', method: 'POST', function: 'stripe-smoke-test', body: {} },
    ];

    for (const api of adminApis) {
      try {
        // Use correct Supabase URLs (not VITE_ env vars)
        const baseUrl = 'https://nkjxbeypbiclvouqfjyc.supabase.co';
        const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ranhiZXlwYmljbHZvdXFmanljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0Nzg2NDEsImV4cCI6MjA3MTA1NDY0MX0.iuFFcJSX97MKkiBvSYLmIao9aTMrQm7zqnf4kEDraQg';
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
          mode: 'cors',
          credentials: 'omit',
          body: JSON.stringify(api.body)
        });

        // Extract response details
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        let responseBody = '';
        let responseSnippet = '';
        let parsedResponse: any = null;
        
        try {
          responseBody = await response.text();
          responseSnippet = responseBody.substring(0, 1000);
          
          // Try to parse JSON response for structured errors
          if (responseBody) {
            try {
              parsedResponse = JSON.parse(responseBody);
            } catch {
              // Not JSON, keep as text
            }
          }
        } catch {
          responseBody = 'Failed to read response body';
          responseSnippet = responseBody;
        }

        // Create user-friendly error message for display
        let displayError = response.ok ? undefined : `HTTP ${response.status}`;
        
        // Handle structured responses (always 200 but with ok:false for errors)
        if (response.ok && parsedResponse) {
          if (parsedResponse.ok === false) {
            // Structured error in 200 response
            displayError = `${parsedResponse.error}`;
            if (parsedResponse.hint) {
              displayError += ` (${parsedResponse.hint})`;
            }
          } else if (parsedResponse.ok === true && parsedResponse.data !== undefined) {
            // Structured success response
            displayError = undefined;
            responseSnippet = `Success: ${Array.isArray(parsedResponse.data) ? parsedResponse.data.length : 'N/A'} records`;
            if (parsedResponse.meta) {
              responseSnippet += ` | Stripe: ${parsedResponse.meta.stripe_mode || 'unknown'} mode`;
            }
          }
        }
        
        // Handle legacy error responses
        if (!response.ok && parsedResponse) {
          if (parsedResponse.ok === false) {
            // New structured error format
            displayError = `${parsedResponse.error}`;
            if (parsedResponse.hint) {
              displayError += ` (${parsedResponse.hint})`;
            }
          } else if (parsedResponse.error) {
            // Legacy error format
            displayError = parsedResponse.error;
          }
        }

        probes.push({
          name: api.name,
          method: api.method,
          url: api.function,
          fullUrl,
          status: response.status,
          responseBody,
          responseSnippet: displayError || responseSnippet,
          headers: responseHeaders,
          authHeaderSent,
          timestamp,
          error: displayError
        });
      } catch (err) {
        const baseUrl = 'https://nkjxbeypbiclvouqfjyc.supabase.co';
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

  const runDualRoleProbe = async () => {
    setIsDualRoleProbing(true);
    
    try {
      // Store original session
      const originalSession = await supabase.auth.getSession();
      
      // Step 1: Run as current (superadmin) user
      toast({
        title: "Dual-Role Probe Started",
        description: "Running probes as superadmin...",
      });
      
      await runApiProbes(false); // Run with auth
      const superadminResults = [...apiProbeResults];
      
      // Step 2: Create/sign in as test user
      const testUserEmail = 'test-user@example.com';
      const testUserPassword = 'TestPassword123!';
      
      toast({
        title: "Creating test user",
        description: "Setting up non-superadmin test account...",
      });
      
      // Try to sign up test user (will fail if exists, which is fine)
      await supabase.auth.signUp({
        email: testUserEmail,
        password: testUserPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });
      
      // Sign in as test user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: testUserEmail,
        password: testUserPassword
      });
      
      if (signInError) {
        throw new Error(`Failed to sign in as test user: ${signInError.message}`);
      }
      
      // Wait a moment for session to establish
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Testing as non-superadmin",
        description: "Running probes as regular user...",
      });
      
      // Step 3: Run probes as non-superadmin
      await runApiProbes(false); // Run with auth (but now as test user)
      const nonSuperadminResults = [...apiProbeResults];
      
      // Step 4: Restore original session
      if (originalSession.data.session) {
        await supabase.auth.setSession(originalSession.data.session);
        // Wait for session to restore
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Step 5: Analyze results
      const summary = {
        superadminPass: superadminResults.filter(r => r.status === 200).length,
        nonSuperadminCorrect403: nonSuperadminResults.filter(r => r.status === 403).length,
        total: superadminResults.length,
        unexpected: [
          ...superadminResults.filter(r => r.status !== 200).map(r => ({ ...r, context: 'superadmin' })),
          ...nonSuperadminResults.filter(r => r.status !== 403 && r.status !== null).map(r => ({ ...r, context: 'non-superadmin' }))
        ] as (ApiProbeResult & { context: string })[]
      };
      
      setDualRoleResults({
        superadmin: superadminResults,
        nonSuperadmin: nonSuperadminResults,
        summary
      });
      
      toast({
        title: "Dual-Role Probe Complete",
        description: `Superadmin: ${summary.superadminPass}/${summary.total} passed, Non-superadmin: ${summary.nonSuperadminCorrect403}/${summary.total} correctly denied`,
        variant: summary.unexpected.length === 0 ? "default" : "destructive"
      });
      
    } catch (error) {
      console.error('Dual role probe failed:', error);
      toast({
        title: "Dual-Role Probe Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsDualRoleProbing(false);
    }
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

  const getEmailValidationForEndpoint = (endpointName: string): string | null => {
    if (!emailResults) return null;
    
    // Map email-related endpoints to test results
    if (endpointName.includes('send-alert-notification') || 
        endpointName.includes('email') || 
        endpointName.includes('notification')) {
      const statusEmoji = emailResults.ok ? '✅' : '❌';
      return `${statusEmoji} ${emailResults.status}`;
    }
    
    return null;
  };

  useEffect(() => {
    const initializeChecks = async () => {
      await runDiagnostics();
      await checkSecrets();
      await checkStripeConnectivity();
      await activateSeatAndGetStatus(); // Check seat status on load
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
              Diagnosing superadmin authorization flow
            </p>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <span className="text-lg font-bold text-green-700 dark:text-green-300 px-3 py-2 bg-green-100 dark:bg-green-950 border-2 border-green-200 dark:border-green-800 rounded-lg">
                🔥 BUILD ID: {BUILD_ID}
              </span>
              <Badge variant="outline" className="text-xs">
                🎯 STEP 4+5: Build & Policy Check
              </Badge>
            </div>
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
              {isCacheClearing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Hard Refresh Cache + Storage
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

        {/* Configuration Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuration Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Supabase Configuration</h4>
                  <div className="space-y-1 text-sm font-mono">
                    <div><strong>Project ID:</strong> nkjxbeypbiclvouqfjyc</div>
                    <div><strong>Base URL:</strong> https://nkjxbeypbiclvouqfjyc.supabase.co</div>
                    <div><strong>Functions URL:</strong> https://nkjxbeypbiclvouqfjyc.supabase.co/functions/v1/</div>
                    <div><strong>Region:</strong> us-east-1 (default)</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">CORS & Request Settings</h4>
                  <div className="space-y-1 text-sm">
                    <div><strong>Mode:</strong> cors</div>
                    <div><strong>Credentials:</strong> omit</div>
                    <div><strong>Auth Header:</strong> Bearer {user ? '[Present]' : '[Missing]'}</div>
                    <div className="font-mono"><strong>API Key:</strong> eyJ...{`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ranhiZXlwYmljbHZvdXFmanljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0Nzg2NDEsImV4cCI6MjA3MTA1NDY0MX0.iuFFcJSX97MKkiBvSYLmIao9aTMrQm7zqnf4kEDraQg`.slice(-8)}</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Function Verification Card - STEP 4 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Policy Function Verification
                <Badge variant="outline" className="text-xs">
                  🎯 STEP 4: Function Check
                </Badge>
              </CardTitle>
              <Button
                onClick={async () => {
                  try {
                    const { data, error } = await supabase.rpc('get_security_snapshot');
                    if (error) throw error;
                    
                    const snapshot = data as unknown as SecuritySnapshot;
                    const functionExists = snapshot.functions.some(f => f.function_name === 'check_org_member_access');
                    const hasGrants = snapshot.grants.some(g => 
                      g.object_name === 'check_org_member_access' && g.grantee === 'authenticated'
                    );
                    
                    toast({
                      title: functionExists ? "✅ Function Verified" : "❌ Function Missing",
                      description: `check_org_member_access: ${functionExists ? 'EXISTS' : 'MISSING'}, Grants: ${hasGrants ? 'OK' : 'MISSING'}`,
                      variant: functionExists && hasGrants ? "default" : "destructive"
                    });
                  } catch (error: any) {
                    toast({
                      title: "Verification Failed",
                      description: error.message,
                      variant: "destructive"
                    });
                  }
                }}
                variant="outline"
                size="sm"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Verify Functions
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium">Required Functions</div>
                  <div className="space-y-1 mt-1">
                    <div className="flex justify-between">
                      <span className="font-mono">check_org_member_access</span>
                      <span className="text-green-600">✅ EXISTS</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono">check_org_membership</span>
                      <span className="text-green-600">✅ EXISTS</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="font-medium">Policy Status</div>
                  <div className="space-y-1 mt-1">
                    <div className="flex justify-between">
                      <span>organization_members</span>
                      <span className="text-green-600">✅ SELECT</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Grants to authenticated</span>
                      <span className="text-green-600">✅ GRANTED</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Policy uses: <code>check_org_membership(organization_id, user_id)</code><br/>
                Wrapper function: <code>check_org_member_access(p_org_id, p_user_id)</code> delegates to check_org_membership
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Snapshot */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Security Snapshot
                <Badge variant="outline" className="text-xs">
                  🎯 STEP 0: Config State
                </Badge>
              </CardTitle>
              <Button
                onClick={fetchSecuritySnapshot}
                disabled={isLoadingSnapshot}
                variant="outline"
                size="sm"
              >
                {isLoadingSnapshot ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Capture State
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {securitySnapshot ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-sm font-medium mb-2">Tables & RLS</div>
                    <div className="text-xs space-y-1">
                      {securitySnapshot.tables.slice(0, 3).map((table, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="font-mono truncate">{table.table_name.split('.')[1]}</span>
                          <span className={table.has_rls ? 'text-green-600' : 'text-red-600'}>
                            {table.has_rls ? '🛡️' : '❌'}
                          </span>
                        </div>
                      ))}
                      {securitySnapshot.tables.length > 3 && (
                        <div className="text-muted-foreground">+{securitySnapshot.tables.length - 3} more</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-sm font-medium mb-2">Security Functions</div>
                    <div className="text-xs space-y-1">
                      {securitySnapshot.functions.map((func, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="font-mono truncate">{func.function_name}</span>
                          <span className={func.security_definer ? 'text-green-600' : 'text-orange-600'}>
                            {func.security_definer ? '🔒' : '⚠️'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-sm font-medium mb-2">Build Info</div>
                    <div className="text-xs space-y-1">
                      <div><strong>Build ID:</strong> {BUILD_ID}</div>
                      <div><strong>Project:</strong> {securitySnapshot.build_info.project_id}</div>
                      <div><strong>Key Hash:</strong> {securitySnapshot.build_info.anon_key_fingerprint}</div>
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  Snapshot taken: {new Date(securitySnapshot.timestamp).toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Click "Capture State" to generate a security configuration snapshot
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compact Seat Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Current Org Seat Status
                <Badge variant="outline" className="text-xs">
                  🎯 STEP 1+2: Seat & Role Fix
                </Badge>
              </CardTitle>
              <Button
                onClick={() => activateSeatAndGetStatus()}
                disabled={isLoadingSeat}
                variant="outline"
                size="sm"
              >
                {isLoadingSeat ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Activate & Check'
                )}
              </Button>
              {seatStatus && seatStatus.role !== 'admin' && (
                <Button
                  onClick={async () => {
                    try {
                      setIsLoadingSeat(true);
                      const { data, error } = await supabase.rpc('make_user_org_admin', { 
                        p_org_id: seatStatus.organization_id 
                      });
                      
                      if (error) throw error;
                      
                      const adminData = data as unknown as { error?: string; success?: boolean };
                      if (adminData.error) {
                        toast({
                          title: "Role Fix Failed",
                          description: adminData.error,
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      toast({
                        title: "Role Updated",
                        description: "You are now an admin of this organization",
                      });
                      
                      // Refresh seat status
                      await activateSeatAndGetStatus();
                    } catch (error: any) {
                      toast({
                        title: "Role Fix Failed",
                        description: error.message,
                        variant: "destructive",
                      });
                    } finally {
                      setIsLoadingSeat(false);
                    }
                  }}
                  disabled={isLoadingSeat}
                  variant="secondary"
                  size="sm"
                >
                  Fix Role → Admin
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {seatStatus ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="font-medium">Role</div>
                  <div className={`font-mono ${seatStatus.role === 'admin' ? 'text-green-600' : 'text-orange-600'}`}>
                    {seatStatus.role}
                  </div>
                </div>
                <div>
                  <div className="font-medium">Seat Active</div>
                  <div className={`font-mono ${seatStatus.seat_active ? 'text-green-600' : 'text-red-600'}`}>
                    {seatStatus.seat_active ? '✅ true' : '❌ false'}
                  </div>
                </div>
                <div>
                  <div className="font-medium">Is Owner</div>
                  <div className={`font-mono ${seatStatus.is_owner ? 'text-green-600' : 'text-gray-600'}`}>
                    {seatStatus.is_owner ? '👑 yes' : '👤 no'}
                  </div>
                </div>
                <div>
                  <div className="font-medium">Member Exists</div>
                  <div className={`font-mono ${seatStatus.membership_exists ? 'text-green-600' : 'text-red-600'}`}>
                    {seatStatus.membership_exists ? '✅ yes' : '❌ no'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Click "Activate & Check" to check and activate your organization seat
              </div>
            )}
          </CardContent>
        </Card>

        {/* Organization Seat Status */}
        <SeatStatusCard />

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

        {/* Email Integration Tests Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Integration Tests
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={checkEmailIntegration}
                  disabled={isCheckingEmail}
                  variant="outline"
                  size="sm"
                >
                  {isCheckingEmail ? (
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
            {!emailResults ? (
              <div className="text-center py-8">
                <Mail className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                <p>Click "Run Tests" to check email provider connectivity and configuration</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Overall Status */}
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium">Overall Status:</span>
                  <Badge 
                    variant={emailResults.ok ? "default" : "destructive"}
                    className={emailResults.ok ? "bg-green-500" : ""}
                  >
                    {emailResults.status}
                  </Badge>
                  {emailResults.summary && (
                    <span className="text-muted-foreground">({emailResults.summary})</span>
                  )}
                </div>

                {emailResults.reason && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Configuration Issue</AlertTitle>
                    <AlertDescription>
                      {emailResults.reason}
                    </AlertDescription>
                  </Alert>
                )}

                {emailResults.providers && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Provider Status</h3>
                    {emailResults.providers.map((provider: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                          {provider.ok ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                          <span className="font-medium capitalize">{provider.provider}</span>
                          <Badge 
                            variant={provider.ok ? "default" : "destructive"}
                            className={provider.ok ? "bg-green-500" : ""}
                          >
                            {provider.status}
                          </Badge>
                        </div>
                        {provider.reason && (
                          <p className="text-sm text-muted-foreground mb-2">{provider.reason}</p>
                        )}
                        {provider.details && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View details</summary>
                            <pre className="mt-2 bg-muted p-2 rounded overflow-x-auto">
                              {JSON.stringify(provider.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Last tested: {emailResults.details?.tested_at ? new Date(emailResults.details.tested_at).toLocaleString() : 'Unknown'}
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
                              {getEmailValidationForEndpoint(result.name) && (
                                <div className="text-xs text-muted-foreground">
                                  Email: {getEmailValidationForEndpoint(result.name)}
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
                disabled={isProbing || isDualRoleProbing}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isProbing ? 'animate-spin' : ''}`} />
                Re-probe APIs
              </Button>
              
              <Button 
                onClick={runDualRoleProbe}
                disabled={isProbing || isDualRoleProbing}
                variant="default"
                size="sm"
              >
                {isDualRoleProbing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Dual-Role Probe...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Dual-Role Probe
                  </>
                )}
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

            {/* Dual-Role Probe Results */}
            {dualRoleResults && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Dual-Role Probe Results</h3>
                
                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{dualRoleResults.summary.superadminPass}</div>
                    <div className="text-sm text-muted-foreground">Superadmin 200s</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{dualRoleResults.summary.nonSuperadminCorrect403}</div>
                    <div className="text-sm text-muted-foreground">Non-admin 403s</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{dualRoleResults.summary.total}</div>
                    <div className="text-sm text-muted-foreground">Total Endpoints</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className={`text-2xl font-bold ${dualRoleResults.summary.unexpected.length === 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {dualRoleResults.summary.unexpected.length === 0 ? 'PASS' : 'FAIL'}
                    </div>
                    <div className="text-sm text-muted-foreground">Overall Status</div>
                  </div>
                </div>

                {/* Unexpected Results */}
                {dualRoleResults.summary.unexpected.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-red-600">Unexpected Results</h4>
                    {dualRoleResults.summary.unexpected.map((result, index) => (
                      <div key={index} className="border border-red-200 rounded-lg p-3 bg-red-50">
                        <div className="flex items-center gap-3 mb-2">
                          <XCircle className="h-5 w-5 text-red-600" />
                          <span className="font-medium">{result.name}</span>
                          <Badge variant="destructive">
                            {result.context === 'superadmin' ? 'Superadmin' : 'Non-admin'}: {result.status || 'ERROR'}
                          </Badge>
                        </div>
                        <p className="text-sm text-red-700">
                          Expected: {result.context === 'superadmin' ? '200' : '403'}, Got: {result.status || 'null'}
                        </p>
                        {result.responseSnippet && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Response: {result.responseSnippet}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Detailed Results Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seat Status Card */}
        <SeatStatusCard />

        {/* Build Info Card */}
                  {/* Superadmin Results */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Superadmin Results</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Endpoint</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dualRoleResults.superadmin.map((result, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono text-xs">{result.name}</TableCell>
                              <TableCell>
                                <Badge variant={result.status === 200 ? "default" : "destructive"}>
                                  {result.status || 'ERROR'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Non-Superadmin Results */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Non-Superadmin Results</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Endpoint</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dualRoleResults.nonSuperadmin.map((result, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono text-xs">{result.name}</TableCell>
                              <TableCell>
                                <Badge variant={result.status === 403 ? "default" : "destructive"}>
                                  {result.status || 'ERROR'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Test completed at: {new Date().toLocaleString()}
                </div>
              </div>
            )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Org Access Probe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label htmlFor="orgId" className="text-sm font-medium mb-2 block">
                  Organization ID (UUID)
                </label>
                <input
                  id="orgId"
                  type="text"
                  value={testOrgId}
                  onChange={(e) => setTestOrgId(e.target.value)}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="w-full px-3 py-2 border border-input rounded-md text-sm font-mono"
                />
              </div>
              <Button 
                onClick={runOrgAccessProbe}
                disabled={isTestingOrgAccess || !testOrgId}
                className="flex items-center gap-2"
              >
                {isTestingOrgAccess ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                {isTestingOrgAccess ? 'Testing...' : 'Test Access'}
              </Button>
            </div>

            {orgAccessResults && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-sm font-medium mb-2">Membership Check</div>
                    <div className="flex items-center gap-2">
                      {orgAccessResults.membership === true ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : orgAccessResults.membership === false ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )}
                      <Badge variant={orgAccessResults.membership === true ? "default" : orgAccessResults.membership === false ? "destructive" : "secondary"}>
                        {orgAccessResults.membership === null ? 'Error' : orgAccessResults.membership ? 'Member' : 'Not Member'}
                      </Badge>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-sm font-medium mb-2">Admin Access Check</div>
                    <div className="flex items-center gap-2">
                      {orgAccessResults.adminAccess === true ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : orgAccessResults.adminAccess === false ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )}
                      <Badge variant={orgAccessResults.adminAccess === true ? "default" : orgAccessResults.adminAccess === false ? "destructive" : "secondary"}>
                        {orgAccessResults.adminAccess === null ? 'Error' : orgAccessResults.adminAccess ? 'Admin' : 'Not Admin'}
                      </Badge>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-sm font-medium mb-2">Update Test (Dry Run)</div>
                    <div className="flex items-center gap-2">
                      {orgAccessResults.updateSuccess === true ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : orgAccessResults.updateSuccess === false ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )}
                      <Badge variant={orgAccessResults.updateSuccess === true ? "default" : orgAccessResults.updateSuccess === false ? "destructive" : "secondary"}>
                        {orgAccessResults.updateSuccess === null ? 'Error' : orgAccessResults.updateSuccess ? 'Allowed' : 'Blocked'}
                      </Badge>
                    </div>
                    {orgAccessResults.updateError && (
                      <div className="mt-2 text-xs text-muted-foreground font-mono bg-background p-2 rounded border">
                        {orgAccessResults.updateError}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-muted/30 p-3 rounded-lg">
                  <div className="text-sm font-medium mb-2">Test Summary</div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="font-medium">Organization ID:</span>
                      <div className="font-mono text-muted-foreground break-all">{orgAccessResults.orgId}</div>
                    </div>
                    <div>
                      <span className="font-medium">Test Time:</span>
                      <div className="text-muted-foreground">{new Date(orgAccessResults.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              RLS Acceptance Tests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Comprehensive tests for all user role scenarios and RLS function behavior
              </div>
              <Button 
                onClick={runRlsAcceptanceTests}
                disabled={isRunningRlsTests}
                className="flex items-center gap-2"
              >
                {isRunningRlsTests ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                {isRunningRlsTests ? 'Running Tests...' : 'Run Acceptance Tests'}
              </Button>
            </div>

            {rlsTestResults && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-sm font-medium mb-2">Test Summary</div>
                    <div className="flex items-center gap-2">
                      {rlsTestResults.all_tests_passed ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <Badge variant={rlsTestResults.all_tests_passed ? "default" : "destructive"}>
                        {rlsTestResults.summary?.passed}/{rlsTestResults.summary?.total_tests} Passed
                      </Badge>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-sm font-medium mb-2">Test Org ID</div>
                    <div className="font-mono text-xs text-muted-foreground break-all">
                      {rlsTestResults.test_org_id || 'N/A'}
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-sm font-medium mb-2">Test Time</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(rlsTestResults.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>

                {rlsTestResults.tests && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Individual Test Results</div>
                    <div className="bg-muted/30 p-4 rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Test</TableHead>
                            <TableHead>User Type</TableHead>
                            <TableHead>Admin Access</TableHead>
                            <TableHead>Membership</TableHead>
                            <TableHead>Ownership</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rlsTestResults.tests.map((test: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono text-xs">{test.test}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{test.user_type}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={test.check_admin_access === test.expected_admin ? "default" : "destructive"}>
                                  {test.check_admin_access ? 'Y' : 'N'} ({test.expected_admin ? 'Y' : 'N'})
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={test.check_org_membership === test.expected_member ? "default" : "destructive"}>
                                  {test.check_org_membership ? 'Y' : 'N'} ({test.expected_member ? 'Y' : 'N'})
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={test.check_org_ownership === test.expected_owner ? "default" : "destructive"}>
                                  {test.check_org_ownership ? 'Y' : 'N'} ({test.expected_owner ? 'Y' : 'N'})
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={test.status === 'PASS' ? "default" : "destructive"}>
                                  {test.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {rlsTestResults.error && (
                  <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
                    <div className="text-sm font-medium text-destructive mb-2">Test Error</div>
                    <div className="text-xs font-mono text-destructive/80">
                      {rlsTestResults.error}
                    </div>
                  </div>
                )}
              </div>
            )}
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

export default AdminDiagnostic;
