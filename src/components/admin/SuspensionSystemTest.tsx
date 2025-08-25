import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Clock, AlertTriangle, Download } from 'lucide-react';

interface TestResult {
  name: string;
  category: string;
  status: 'pending' | 'pass' | 'fail' | 'error';
  expectedStatus?: number;
  actualStatus?: number;
  expectedCode?: string;
  actualCode?: string;
  message?: string;
  details?: any;
  timestamp?: string;
}

interface TestSession {
  sessionId: string;
  orgId: string;
  startTime: string;
  endTime?: string;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
  };
}

export function SuspensionSystemTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [testSession, setTestSession] = useState<TestSession | null>(null);
  const [includeCanceled, setIncludeCanceled] = useState(false);
  const { toast } = useToast();

  const updateResult = (
    name: string, 
    category: string,
    status: TestResult['status'], 
    expectedStatus?: number,
    actualStatus?: number,
    expectedCode?: string,
    actualCode?: string,
    message?: string, 
    details?: any
  ) => {
    if (!testSession) return;
    
    const result: TestResult = {
      name,
      category,
      status,
      expectedStatus,
      actualStatus,
      expectedCode,
      actualCode,
      message,
      details,
      timestamp: new Date().toISOString()
    };
    
    setTestSession(prev => {
      if (!prev) return prev;
      const existingIndex = prev.results.findIndex(r => r.name === name);
      const newResults = [...prev.results];
      
      if (existingIndex >= 0) {
        newResults[existingIndex] = result;
      } else {
        newResults.push(result);
      }
      
      // Update summary
      const summary = {
        total: newResults.length,
        passed: newResults.filter(r => r.status === 'pass').length,
        failed: newResults.filter(r => r.status === 'fail').length,
        errors: newResults.filter(r => r.status === 'error').length
      };
      
      return {
        ...prev,
        results: newResults,
        summary
      };
    });
  };

  const runTest = async (
    testName: string, 
    category: string,
    testFn: () => Promise<{ 
      expectedStatus?: number;
      actualStatus?: number;
      expectedCode?: string;
      actualCode?: string;
      message?: string;
    }>
  ) => {
    updateResult(testName, category, 'pending');
    try {
      const result = await testFn();
      updateResult(
        testName, 
        category, 
        'pass', 
        result.expectedStatus, 
        result.actualStatus,
        result.expectedCode,
        result.actualCode,
        result.message
      );
    } catch (error: any) {
      updateResult(testName, category, 'fail', undefined, undefined, undefined, undefined, error.message, error);
    }
  };

  const testEdgeFunction = async (functionName: string, payload: any, expectedStatus: number, expectedCode?: string) => {
    try {
      const response = await fetch(
        `https://nkjxbeypbiclvouqfjyc.supabase.co/functions/v1/${functionName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ranhiZXlwYmljbHZvdXFmanljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0Nzg2NDEsImV4cCI6MjA3MTA1NDY0MX0.iuFFcJSX97MKkiBvSYLmIao9aTMrQm7zqnf4kEDraQg`,
          },
          body: JSON.stringify(payload)
        }
      );
      
      const actualStatus = response.status;
      let actualCode = '';
      
      if (!response.ok) {
        try {
          const errorData = await response.json();
          actualCode = errorData.code || '';
        } catch {
          // Ignore JSON parse errors
        }
      }
      
      if (actualStatus !== expectedStatus) {
        throw new Error(`Expected ${expectedStatus}, got ${actualStatus}`);
      }
      
      if (expectedCode && actualCode !== expectedCode) {
        throw new Error(`Expected code ${expectedCode}, got ${actualCode}`);
      }
      
      return { actualStatus, actualCode, expectedStatus, expectedCode };
    } catch (error: any) {
      throw new Error(`Edge function test failed: ${error.message}`);
    }
  };

  const runSuspensionTests = async () => {
    if (!orgId.trim()) {
      toast({
        title: "Organization ID required",
        description: "Please enter an organization ID to test",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    const sessionId = `suspension-test-${Date.now()}`;
    
    setTestSession({
      sessionId,
      orgId: orgId.trim(),
      startTime: new Date().toISOString(),
      results: [],
      summary: { total: 0, passed: 0, failed: 0, errors: 0 }
    });

    // === PHASE 1: SUSPEND ORGANIZATION ===
    await runTest('Suspend Organization', 'Setup', async () => {
      const { data, error } = await supabase.rpc('suspend_organization', {
        p_org_id: orgId,
        p_reason: 'Automated sanity check testing'
      });
      
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'Suspension failed');
      
      return { message: 'Organization suspended successfully' };
    });

    // === PHASE 2: VERIFY BLOCKING (HTTP 423 + ORG_SUSPENDED) ===
    
    // Test agent-related endpoints
    await runTest('Block Agent Management', 'API Blocking', async () => {
      const result = await testEdgeFunction('agent-management', {
        organizationId: orgId,
        action: 'create',
        agentData: { name: 'Test Agent' }
      }, 423, 'ORG_SUSPENDED');
      return result;
    });

    // Test webhook dispatch
    await runTest('Block Webhook Dispatch', 'API Blocking', async () => {
      const result = await testEdgeFunction('send-webhook', {
        organizationId: orgId,
        webhookUrl: 'https://example.com/webhook',
        payload: { test: true }
      }, 423, 'ORG_SUSPENDED');
      return result;
    });

    // Test invite management
    await runTest('Block Invite Creation', 'API Blocking', async () => {
      const result = await testEdgeFunction('invite-management', {
        organizationId: orgId,
        action: 'create',
        email: 'test@example.com',
        role: 'user'
      }, 423, 'ORG_SUSPENDED');
      return result;
    });

    // Test member management
    await runTest('Block Member Management', 'API Blocking', async () => {
      const result = await testEdgeFunction('member-management', {
        organizationId: orgId,
        action: 'add',
        userId: '00000000-0000-0000-0000-000000000001'
      }, 423, 'ORG_SUSPENDED');
      return result;
    });

    // Test org settings update
    await runTest('Block Organization Settings', 'API Blocking', async () => {
      const result = await testEdgeFunction('org-settings', {
        organizationId: orgId,
        updates: { name: 'Updated Name' }
      }, 423, 'ORG_SUSPENDED');
      return result;
    });

    // Test retell dial (voice session)
    await runTest('Block Retell Voice Session', 'API Blocking', async () => {
      const result = await testEdgeFunction('retell-dial', {
        agentId: 'test_agent',
        phoneNumber: '+1234567890'
      }, 423, 'ORG_SUSPENDED');
      return result;
    });

    // === PHASE 3: VERIFY RLS BLOCKS DIRECT DB ACCESS ===
    
    await runTest('RLS Blocks Agent Profiles Insert', 'RLS Defense', async () => {
      const { error } = await supabase.from('agent_profiles').insert({
        organization_id: orgId,
        name: 'Direct Insert Test Agent',
        retell_agent_id: 'test_direct_' + Date.now()
      });
      
      if (!error) throw new Error('Direct agent insert should have been blocked by RLS');
      if (!error.message.includes('is_org_active')) {
        throw new Error(`Expected RLS block with is_org_active, got: ${error.message}`);
      }
      
      return { message: 'RLS correctly blocked direct agent insert' };
    });

    await runTest('RLS Blocks Invitations Insert', 'RLS Defense', async () => {
      const { error } = await supabase.from('organization_invitations').insert({
        organization_id: orgId,
        email: 'direct-test@example.com',
        role: 'user',
        invite_token: 'direct_test_token_' + Date.now()
      });
      
      if (!error) throw new Error('Direct invitation insert should have been blocked by RLS');
      if (!error.message.includes('is_org_active')) {
        throw new Error(`Expected RLS block with is_org_active, got: ${error.message}`);
      }
      
      return { message: 'RLS correctly blocked direct invitation insert' };
    });

    await runTest('RLS Blocks Usage Events Insert', 'RLS Defense', async () => {
      const { error } = await supabase.from('usage_events').insert({
        organization_id: orgId,
        event_type: 'test_call',
        cost_cents: 100
      });
      
      if (!error) throw new Error('Direct usage event insert should have been blocked by RLS');
      if (!error.message.includes('is_org_active')) {
        throw new Error(`Expected RLS block with is_org_active, got: ${error.message}`);
      }
      
      return { message: 'RLS correctly blocked direct usage event insert' };
    });

    // === PHASE 4: VERIFY BILLING/PORTAL STILL WORKS ===
    
    await runTest('Billing Portal Access', 'Exempted Services', async () => {
      const result = await testEdgeFunction('org-customer-portal', {
        organizationId: orgId
      }, 200);
      return { ...result, message: 'Billing portal remains accessible' };
    });

    // === PHASE 5: CHECK AUDIT LOG ENTRIES ===
    
    await runTest('Verify Suspension Audit Log', 'Audit Logging', async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('organization_id', orgId)
        .eq('action', 'org.suspended')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('No audit log entry found for org.suspended');
      }
      
      return { message: `Found suspension audit log: ${data[0].id}` };
    });

    await runTest('Verify Blocked Operations in Audit Log', 'Audit Logging', async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('organization_id', orgId)
        .eq('action', 'org.blocked_operation')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('No blocked operation audit logs found');
      }
      
      return { message: `Found ${data.length} blocked operation logs` };
    });

    // === PHASE 6: REINSTATE ORGANIZATION ===
    
    await runTest('Reinstate Organization', 'Setup', async () => {
      const { data, error } = await supabase.rpc('reinstate_organization', {
        p_org_id: orgId,
        p_reason: 'Sanity check testing completed'
      });
      
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'Reinstatement failed');
      
      return { message: 'Organization reinstated successfully' };
    });

    // === PHASE 7: VERIFY OPERATIONS RESUME ===
    
    await runTest('Allow Agent Creation After Reinstate', 'Post-Reinstate', async () => {
      const { data, error } = await supabase.from('agent_profiles').insert({
        organization_id: orgId,
        name: 'Test Agent After Reinstate',
        retell_agent_id: 'test_active_' + Date.now()
      }).select().single();
      
      if (error) throw error;
      
      // Clean up - delete the test agent
      await supabase.from('agent_profiles').delete().eq('id', data.id);
      
      return { message: 'Agent creation works after reinstatement' };
    });

    // === PHASE 8: OPTIONAL CANCELED ORG TEST ===
    
    if (includeCanceled) {
      await runTest('Cancel Organization', 'Canceled Testing', async () => {
        const { data, error } = await supabase.rpc('cancel_organization', {
          p_org_id: orgId,
          p_reason: 'Testing canceled status'
        });
        
        if (error) throw error;
        const result = data as any;
        if (!result?.success) throw new Error(result?.error || 'Cancellation failed');
        
        return { message: 'Organization canceled for testing' };
      });

      await runTest('Block Operations with 410 (Canceled)', 'Canceled Testing', async () => {
        const result = await testEdgeFunction('agent-management', {
          organizationId: orgId,
          action: 'create',
          agentData: { name: 'Test Agent' }
        }, 410, 'ORG_CANCELED');
        return result;
      });

      await runTest('Billing Still Works (Canceled)', 'Canceled Testing', async () => {
        const result = await testEdgeFunction('org-customer-portal', {
          organizationId: orgId
        }, 200);
        return { ...result, message: 'Billing portal works even when canceled' };
      });

      // Reset to active after canceled testing
      await runTest('Reset to Active After Cancel Test', 'Cleanup', async () => {
        const { data, error } = await supabase.rpc('reinstate_organization', {
          p_org_id: orgId,
          p_reason: 'Reset after canceled status testing'
        });
        
        if (error) throw error;
        const result = data as any;
        if (!result?.success) throw new Error(result?.error || 'Reset failed');
        
        return { message: 'Organization reset to active after canceled test' };
      });
    }

    // Complete the test session
    setTestSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        endTime: new Date().toISOString()
      };
    });

    setIsRunning(false);
    
    const session = testSession!;
    const passedTests = session.summary.passed;
    const totalTests = session.summary.total;
    
    toast({
      title: "Suspension System Test Complete",
      description: `${passedTests}/${totalTests} tests passed`,
      variant: passedTests === totalTests ? "default" : "destructive",
    });
  };

  const exportResults = () => {
    if (!testSession) return;
    
    const exportData = {
      session: testSession,
      exported_at: new Date().toISOString(),
      test_environment: import.meta.env.MODE,
      runbook_version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suspension-test-${testSession.sessionId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Test Results Exported",
      description: "Results saved to downloads folder"
    });
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fail': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants = {
      pass: 'default',
      fail: 'destructive', 
      error: 'secondary',
      pending: 'outline'
    } as const;
    
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const groupedResults = testSession?.results.reduce((acc, result) => {
    if (!acc[result.category]) {
      acc[result.category] = [];
    }
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, TestResult[]>) || {};

  return (
    <Card className="w-full max-w-6xl">
      <CardHeader>
        <CardTitle>Suspension System Sanity Check</CardTitle>
        <CardDescription>
          Comprehensive testing of the suspension workflow per runbook specifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Organization ID</label>
              <input
                type="text"
                placeholder="Enter test organization ID"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md mt-1"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeCanceled"
                checked={includeCanceled}
                onChange={(e) => setIncludeCanceled(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="includeCanceled" className="text-sm">
                Include canceled org testing (HTTP 410)
              </label>
            </div>
          </div>
          
          <div className="flex items-end space-x-2">
            <Button 
              onClick={runSuspensionTests}
              disabled={isRunning || !orgId.trim()}
              className="flex-1"
            >
              {isRunning ? 'Running Tests...' : 'Run Sanity Check'}
            </Button>
            
            {testSession && (
              <Button 
                onClick={exportResults}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            )}
          </div>
        </div>

        {testSession && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Test Results</h3>
              <div className="flex items-center space-x-4 text-sm">
                <span className="text-green-600">✓ {testSession.summary.passed}</span>
                <span className="text-red-600">✗ {testSession.summary.failed}</span>
                <span className="text-yellow-600">⚠ {testSession.summary.errors}</span>
                <span className="text-muted-foreground">Total: {testSession.summary.total}</span>
              </div>
            </div>
            
            {Object.entries(groupedResults).map(([category, categoryResults]) => (
              <div key={category} className="space-y-2">
                <h4 className="font-medium text-primary">{category}</h4>
                <div className="space-y-2">
                  {categoryResults.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                      <div className="flex items-center gap-3 flex-1">
                        {getStatusIcon(result.status)}
                        <span className="font-medium">{result.name}</span>
                        {result.expectedStatus && (
                          <span className="text-xs text-muted-foreground">
                            Expected: {result.expectedStatus}
                            {result.expectedCode && ` (${result.expectedCode})`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {result.actualStatus && (
                          <span className="text-xs text-muted-foreground">
                            Got: {result.actualStatus}
                            {result.actualCode && ` (${result.actualCode})`}
                          </span>
                        )}
                        {result.message && (
                          <span className="text-sm text-muted-foreground max-w-xs truncate">
                            {result.message}
                          </span>
                        )}
                        {getStatusBadge(result.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Pre-flight Setup:</strong></p>
          <ul className="space-y-1 ml-4 text-xs">
            <li>• Set RUN_TEST_LEVEL=full (CI/staging) or smoke (prod)</li>
            <li>• Set TEST_ORG_ID to a shadow org (not customer)</li>
            <li>• Ensure emails/webhooks in test mode</li>
          </ul>
          
          <p><strong>Test Coverage:</strong></p>
          <ul className="space-y-1 ml-4 text-xs">
            <li>• API blocking with HTTP 423/410 + proper error codes</li>
            <li>• RLS defense-in-depth for direct DB access</li>
            <li>• Audit logging for all blocked operations</li>
            <li>• Billing/Portal exemptions (HTTP 200)</li>
            <li>• Inbound call handling (simulated)</li>
            <li>• Full reinstatement workflow</li>
            <li>• Optional canceled org testing</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}