import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { 
  Play, 
  TestTube, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2,
  Shield,
  Database 
} from 'lucide-react';

interface TestResult {
  name: string;
  success: boolean;
  expectedStatus?: number;
  actualStatus?: number;
  error?: string;
  blocked?: boolean;
  audit_logged?: boolean;
}

interface TestSuite {
  status: string;
  totalTests: number;
  passed: number;
  failed: number;
  tests: TestResult[];
}

export default function GuardTests() {
  const { toast } = useToast();
  const { organization } = useUserOrganization();
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [customOrgId, setCustomOrgId] = useState('');

  const runGuardTests = async (testType: 'guard' | 'smoke') => {
    const orgId = customOrgId || organization?.id;
    if (!orgId) {
      toast({
        title: "Error",
        description: "Please provide an organization ID",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    setTestResults(null);

    try {
      const functionName = testType === 'guard' ? 'guard-tests' : 'smoke-tests';
      
      if (testType === 'guard') {
        // Run individual guard tests for each scenario
        const scenarios = ['suspended', 'canceled', 'active'];
        const operations = ['agent_operations', 'webhook_operations', 'invite_operations', 'billing_operations'];
        
        const allResults = [];
        
        for (const scenario of scenarios) {
          for (const operation of operations) {
            const { data, error } = await supabase.functions.invoke(functionName, {
              body: {
                organizationId: orgId,
                testType: 'guard',
                scenario,
                operation
              }
            });

            if (error) throw error;
            allResults.push(data);
          }
        }
        
        setTestResults({ type: 'guard', results: allResults });
      } else {
        // Run comprehensive smoke tests
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: {
            organizationId: orgId,
            suspendFirst: true
          }
        });

        if (error) throw error;
        setTestResults({ type: 'smoke', results: data });
      }

      toast({
        title: "Tests completed",
        description: `${testType === 'guard' ? 'Guard' : 'Smoke'} tests have finished running`,
      });

    } catch (error) {
      console.error('Test execution error:', error);
      toast({
        title: "Test failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const renderGuardResults = (results: any[]) => {
    const groupedResults = results.reduce((acc, result) => {
      const key = `${result.scenario}-${result.operation}`;
      acc[key] = result;
      return acc;
    }, {});

    return (
      <div className="space-y-4">
        {Object.entries(groupedResults).map(([key, result]: [string, any]) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{result.operation.replace('_', ' ')} - {result.scenario}</span>
                <Badge variant={getOverallSuccess(result.results) ? "default" : "destructive"}>
                  {getOverallSuccess(result.results) ? "PASS" : "FAIL"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(result.results).map(([endpoint, testResult]: [string, any]) => (
                  <div key={endpoint} className="flex items-center justify-between p-2 border rounded">
                    <span className="font-medium">{endpoint}</span>
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <Badge variant={testResult.success ? "default" : "destructive"}>
                        {testResult.actualStatus}
                      </Badge>
                      {testResult.blocked && (
                        <Badge variant="secondary">Blocked</Badge>
                      )}
                      {testResult.audit_logged && (
                        <Badge variant="outline">Audited</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderSmokeResults = (results: any) => {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Test Summary</span>
              <Badge variant={results.summary.overallSuccess ? "default" : "destructive"}>
                {results.summary.overallSuccess ? "ALL PASS" : "SOME FAILED"}
              </Badge>
            </CardTitle>
            <CardDescription>
              {results.summary.totalTests} total tests: {results.summary.passed} passed, {results.summary.failed} failed
            </CardDescription>
          </CardHeader>
          <CardContent>
            {results.summary.errors.length > 0 && (
              <div className="space-y-2">
                <Label className="text-red-600">Errors:</Label>
                {results.summary.errors.map((error: string, index: number) => (
                  <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {error}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {results.testSequence.map((suite: TestSuite, index: number) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Status: {suite.status}</span>
                <Badge variant={suite.failed === 0 ? "default" : "destructive"}>
                  {suite.passed}/{suite.totalTests}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {suite.tests.map((test: TestResult, testIndex: number) => (
                  <div key={testIndex} className="flex items-center justify-between p-2 border rounded">
                    <span className="font-medium">{test.name}</span>
                    <div className="flex items-center gap-2">
                      {test.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      {test.actualStatus && (
                        <Badge variant={test.success ? "default" : "destructive"}>
                          {test.actualStatus}
                        </Badge>
                      )}
                      {test.blocked && (
                        <Badge variant="secondary">Blocked</Badge>
                      )}
                      {test.audit_logged && (
                        <Badge variant="outline">Audited</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const getOverallSuccess = (results: any) => {
    return Object.values(results).every((result: any) => result.success);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Guard System Tests</h1>
        <p className="text-muted-foreground">
          Test the global guard system and database RLS policies
        </p>
      </div>

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Test Configuration
          </CardTitle>
          <CardDescription>
            Configure and run tests for the organization guard system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="orgId">Organization ID</Label>
            <Input
              id="orgId"
              value={customOrgId}
              onChange={(e) => setCustomOrgId(e.target.value)}
              placeholder={organization?.id || "Enter organization ID"}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty to use current organization: {organization?.id}
            </p>
          </div>

          <div className="flex gap-4">
            <Button 
              onClick={() => runGuardTests('guard')} 
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              Run Guard Tests
            </Button>

            <Button 
              onClick={() => runGuardTests('smoke')} 
              disabled={isRunning}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              Run Smoke Tests
            </Button>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Test Types</p>
                <ul className="space-y-1 text-xs">
                  <li>• <strong>Guard Tests:</strong> Test edge function guards for each status/operation</li>
                  <li>• <strong>Smoke Tests:</strong> Full end-to-end tests including RLS bypass verification</li>
                  <li>• Tests will modify organization status temporarily</li>
                  <li>• Organization will be restored to active status after tests</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Test Results
            </CardTitle>
            <CardDescription>
              Results from {testResults.type} tests
            </CardDescription>
          </CardHeader>
          <CardContent>
            {testResults.type === 'guard' 
              ? renderGuardResults(testResults.results)
              : renderSmokeResults(testResults.results)
            }
          </CardContent>
        </Card>
      )}
    </div>
  );
}