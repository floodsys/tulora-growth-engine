import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pending' | 'pass' | 'fail' | 'error';
  message?: string;
  details?: any;
}

export function SuspensionSystemTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [results, setResults] = useState<TestResult[]>([]);
  const { toast } = useToast();

  const updateResult = (name: string, status: TestResult['status'], message?: string, details?: any) => {
    setResults(prev => {
      const existing = prev.find(r => r.name === name);
      if (existing) {
        existing.status = status;
        existing.message = message;
        existing.details = details;
        return [...prev];
      }
      return [...prev, { name, status, message, details }];
    });
  };

  const runTest = async (testName: string, testFn: () => Promise<void>) => {
    updateResult(testName, 'pending');
    try {
      await testFn();
      updateResult(testName, 'pass');
    } catch (error: any) {
      updateResult(testName, 'fail', error.message, error);
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
    setResults([]);

    // Test 1: Suspend organization
    await runTest('Suspend Organization', async () => {
      const { data, error } = await supabase.rpc('suspend_organization', {
        p_org_id: orgId,
        p_reason: 'Testing suspension system'
      });
      
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'Suspension failed');
    });

    // Test 2: Try agent creation (should fail)
    await runTest('Block Agent Creation', async () => {
      const { error } = await supabase.from('agent_profiles').insert({
        organization_id: orgId,
        name: 'Test Agent',
        retell_agent_id: 'test_' + Date.now()
      });
      
      if (!error) throw new Error('Agent creation should have been blocked');
      if (!error.message.includes('is_org_active')) {
        throw new Error('Agent blocked for wrong reason: ' + error.message);
      }
    });

    // Test 3: Try invite creation (should fail)
    await runTest('Block Invite Creation', async () => {
      const { error } = await supabase.from('organization_invitations').insert({
        organization_id: orgId,
        email: 'test@example.com',
        role: 'user',
        invite_token: 'test_token_' + Date.now()
      });
      
      if (!error) throw new Error('Invite creation should have been blocked');
      if (!error.message.includes('is_org_active')) {
        throw new Error('Invite blocked for wrong reason: ' + error.message);
      }
    });

    // Test 4: Check audit log entry
    await runTest('Verify Audit Log Entry', async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('organization_id', orgId)
        .eq('action', 'org.suspended')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('No audit log entry found for suspension');
      }
    });

    // Test 5: Billing/Portal access (simulate)
    await runTest('Billing Portal Access', async () => {
      // Billing should still work - just check org read access
      const { data, error } = await supabase
        .from('organizations')
        .select('billing_status, stripe_customer_id')
        .eq('id', orgId)
        .single();
      
      if (error) throw error;
      // Billing access should still work even when suspended
    });

    // Test 6: Reinstate organization
    await runTest('Reinstate Organization', async () => {
      const { data, error } = await supabase.rpc('reinstate_organization', {
        p_org_id: orgId,
        p_reason: 'Testing completed'
      });
      
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'Reinstatement failed');
    });

    // Test 7: Try agent creation again (should work)
    await runTest('Allow Agent Creation After Reinstate', async () => {
      const { data, error } = await supabase.from('agent_profiles').insert({
        organization_id: orgId,
        name: 'Test Agent After Reinstate',
        retell_agent_id: 'test_active_' + Date.now()
      }).select().single();
      
      if (error) throw error;
      
      // Clean up - delete the test agent
      await supabase.from('agent_profiles').delete().eq('id', data.id);
    });

    setIsRunning(false);
    
    const passedTests = results.filter(r => r.status === 'pass').length;
    const totalTests = results.length;
    
    toast({
      title: "Suspension System Test Complete",
      description: `${passedTests}/${totalTests} tests passed`,
      variant: passedTests === totalTests ? "default" : "destructive",
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

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Suspension System Sanity Check</CardTitle>
        <CardDescription>
          Tests the complete suspension workflow: suspend → block operations → reinstate → resume operations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-4 items-center">
          <input
            type="text"
            placeholder="Organization ID"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-md"
          />
          <Button 
            onClick={runSuspensionTests}
            disabled={isRunning || !orgId.trim()}
          >
            {isRunning ? 'Running Tests...' : 'Run Suspension Tests'}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Test Results</h3>
            {results.map((result, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status)}
                  <span className="font-medium">{result.name}</span>
                </div>
                <div className="flex items-center gap-2">
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
        )}

        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Test Coverage:</strong></p>
          <ul className="space-y-1 ml-4">
            <li>• Suspend organization with reason</li>
            <li>• Verify agent creation blocked (RLS)</li>
            <li>• Verify invite creation blocked (RLS)</li>
            <li>• Check audit log entries created</li>
            <li>• Confirm billing access still works</li>
            <li>• Reinstate organization</li>
            <li>• Verify operations resume normally</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}