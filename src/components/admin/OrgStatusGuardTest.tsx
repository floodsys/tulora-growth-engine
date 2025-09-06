import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Play, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TestResult {
  endpoint: string;
  status: 'pending' | 'pass' | 'fail';
  expectedCode: number;
  actualCode?: number;
  expectedBody?: string;
  actualBody?: string;
  error?: string;
}

export function OrgStatusGuardTest() {
  const [orgId, setOrgId] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const { toast } = useToast();

  const operationalEndpoints = [
    { name: 'agents', expectedCode: 423, payload: { organizationId: '', action: 'create', agentData: { name: 'Test' } } },
    { name: 'retell-dial', expectedCode: 423, payload: { agentId: 'test', phoneNumber: '+1234567890' } },
    { name: 'invite-management', expectedCode: 423, payload: { organizationId: '', action: 'create', email: 'test@example.com', role: 'user' } },
    { name: 'member-management', expectedCode: 423, payload: { organizationId: '', action: 'add', userId: '00000000-0000-0000-0000-000000000001' } },
    { name: 'org-settings', expectedCode: 423, payload: { organizationId: '', updates: { name: 'Updated' } } },
    { name: 'send-webhook', expectedCode: 423, payload: { event: { organization_id: '', action: 'test' } } }
  ];

  const exemptedEndpoints = [
    { name: 'org-customer-portal', expectedCode: 200, payload: { organizationId: '' } }
  ];

  const testEndpoint = async (endpoint: string, payload: any, expectedCode: number): Promise<TestResult> => {
    try {
      const response = await fetch(
        `https://nkjxbeypbiclvouqfjyc.supabase.co/functions/v1/${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify(payload)
        }
      );

      const actualCode = response.status;
      let actualBody = '';

      try {
        const responseData = await response.json();
        actualBody = JSON.stringify(responseData);
      } catch {
        actualBody = await response.text();
      }

      if (actualCode === expectedCode) {
        return {
          endpoint,
          status: 'pass',
          expectedCode,
          actualCode,
          actualBody
        };
      } else {
        return {
          endpoint,
          status: 'fail',
          expectedCode,
          actualCode,
          actualBody,
          error: `Expected ${expectedCode}, got ${actualCode}`
        };
      }
    } catch (error: any) {
      return {
        endpoint,
        status: 'fail',
        expectedCode,
        error: error.message
      };
    }
  };

  const runGuardTests = async () => {
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

    // First suspend the organization
    try {
      const { data, error } = await supabase.rpc('suspend_organization', {
        p_org_id: orgId,
        p_reason: 'Automated guard testing'
      });

      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'Suspension failed');

      toast({
        title: "Organization suspended",
        description: "Testing operational endpoint blocking...",
      });
    } catch (error: any) {
      toast({
        title: "Failed to suspend organization",
        description: error.message,
        variant: "destructive",
      });
      setIsRunning(false);
      return;
    }

    // Test operational endpoints (should return 423)
    const initialResults: TestResult[] = [
      ...operationalEndpoints.map(ep => ({ 
        endpoint: ep.name, 
        status: 'pending' as const, 
        expectedCode: ep.expectedCode 
      })),
      ...exemptedEndpoints.map(ep => ({ 
        endpoint: ep.name, 
        status: 'pending' as const, 
        expectedCode: ep.expectedCode 
      }))
    ];
    setResults(initialResults);

    for (let i = 0; i < operationalEndpoints.length; i++) {
      const ep = operationalEndpoints[i];
      const payload = { ...ep.payload, organizationId: orgId };
      if (ep.payload.event) {
        payload.event.organization_id = orgId;
      }

      const result = await testEndpoint(ep.name, payload, ep.expectedCode);
      setResults(prev => prev.map((r, idx) => idx === i ? result : r));
    }

    // Test exempted endpoints (should work normally)
    for (let i = 0; i < exemptedEndpoints.length; i++) {
      const ep = exemptedEndpoints[i];
      const payload = { ...ep.payload, organizationId: orgId };

      const result = await testEndpoint(ep.name, payload, ep.expectedCode);
      setResults(prev => prev.map((r, idx) => 
        idx === (operationalEndpoints.length + i) ? result : r
      ));
    }

    // Reinstate the organization
    try {
      await supabase.rpc('reinstate_organization', {
        p_org_id: orgId,
        p_reason: 'Testing completed'
      });

      toast({
        title: "Organization reinstated",
        description: "Guard testing completed successfully",
      });
    } catch (error: any) {
      toast({
        title: "Failed to reinstate organization",
        description: error.message,
        variant: "destructive",
      });
    }

    setIsRunning(false);
  };

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const pendingCount = results.filter(r => r.status === 'pending').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Organization Status Guard Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This test will temporarily suspend an organization to verify that all operational 
            endpoints return HTTP 423 (ORG_SUSPENDED) while billing/portal endpoints remain accessible.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgId">Organization ID to Test</Label>
            <Input
              id="orgId"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Enter organization UUID"
            />
          </div>

          <Button 
            onClick={runGuardTests} 
            disabled={isRunning || !orgId.trim()}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            {isRunning ? 'Testing Guard System...' : 'Run Guard Tests'}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge variant="outline" className="text-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Passed: {passCount}
              </Badge>
              <Badge variant="outline" className="text-red-600">
                <XCircle className="h-3 w-3 mr-1" />
                Failed: {failCount}
              </Badge>
              {pendingCount > 0 && (
                <Badge variant="outline" className="text-yellow-600">
                  Pending: {pendingCount}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Operational Endpoints (Should Return 423)</h4>
              {results.slice(0, operationalEndpoints.length).map((result, idx) => (
                <div
                  key={result.endpoint}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    {result.status === 'pass' && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {result.status === 'fail' && <XCircle className="h-4 w-4 text-red-600" />}
                    {result.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-dashed border-gray-400 animate-pulse" />}
                    
                    <span className="font-mono text-sm">{result.endpoint}</span>
                  </div>
                  
                  <div className="text-sm text-right">
                    <div>Expected: {result.expectedCode}</div>
                    {result.actualCode && (
                      <div className={result.status === 'pass' ? 'text-green-600' : 'text-red-600'}>
                        Actual: {result.actualCode}
                      </div>
                    )}
                    {result.error && (
                      <div className="text-red-600 text-xs">{result.error}</div>
                    )}
                  </div>
                </div>
              ))}

              <h4 className="font-medium mt-6">Exempted Endpoints (Should Work Normally)</h4>
              {results.slice(operationalEndpoints.length).map((result, idx) => (
                <div
                  key={result.endpoint}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    {result.status === 'pass' && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {result.status === 'fail' && <XCircle className="h-4 w-4 text-red-600" />}
                    {result.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-dashed border-gray-400 animate-pulse" />}
                    
                    <span className="font-mono text-sm">{result.endpoint}</span>
                  </div>
                  
                  <div className="text-sm text-right">
                    <div>Expected: {result.expectedCode}</div>
                    {result.actualCode && (
                      <div className={result.status === 'pass' ? 'text-green-600' : 'text-red-600'}>
                        Actual: {result.actualCode}
                      </div>
                    )}
                    {result.error && (
                      <div className="text-red-600 text-xs">{result.error}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}