import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TestResult {
  endpoint: string;
  method: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  error?: string;
}

interface UserTestResults {
  userType: 'superadmin' | 'non-superadmin';
  email: string;
  authResult: 'success' | 'failed';
  tests: TestResult[];
  overallPassed: boolean;
}

const ADMIN_ENDPOINTS = [
  { name: 'admin-billing-actions', method: 'POST' as const, body: { action: 'test_probe' } },
  { name: 'admin-billing-overview', method: 'POST' as const, body: { action: 'test_probe' } },
  { name: 'org-suspension', method: 'POST' as const, body: { action: 'test_probe' } },
];

const TEST_USERS = {
  superadmin: {
    email: 'admin@axionstack.xyz', // This should be a real superadmin
    expectedStatus: 200
  },
  nonSuperadmin: {
    email: 'test@example.com', // This should be a regular user
    expectedStatus: 403
  }
};

export default function SuperadminTestHarness() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<UserTestResults[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const { toast } = useToast();

  const testEndpoint = async (endpoint: string, method: 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE', body: any, expectedStatus: number): Promise<TestResult> => {
    try {
      const { data, error } = await supabase.functions.invoke(endpoint, {
        body
      });

      let actualStatus = 200;
      if (error) {
        actualStatus = error.status || 500;
      }

      return {
        endpoint,
        method,
        expectedStatus,
        actualStatus,
        passed: actualStatus === expectedStatus,
        error: error?.message
      };
    } catch (err) {
      return {
        endpoint,
        method,
        expectedStatus,
        actualStatus: 500,
        passed: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  };

  const testDiagnosticPage = async (expectedStatus: number): Promise<TestResult> => {
    try {
      // Test if diagnostic page is accessible by checking auth state
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          endpoint: '/admin?tab=diagnostics',
          method: 'GET',
          expectedStatus,
          actualStatus: 401,
          passed: expectedStatus === 401,
          error: 'Not authenticated'
        };
      }

      // Check if user has admin access
      const { data: isSuperadmin } = await supabase.rpc('is_superadmin');
      const actualStatus = isSuperadmin ? 200 : 403;

      return {
        endpoint: '/admin?tab=diagnostics',
        method: 'GET',
        expectedStatus,
        actualStatus,
        passed: actualStatus === expectedStatus
      };
    } catch (err) {
      return {
        endpoint: '/admin?tab=diagnostics',
        method: 'GET',
        expectedStatus,
        actualStatus: 500,
        passed: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  };

  const runTestsForUser = async (userType: 'superadmin' | 'non-superadmin'): Promise<UserTestResults> => {
    const userConfig = TEST_USERS[userType];
    const tests: TestResult[] = [];

    // Note: In a real implementation, you'd need to handle user switching
    // For now, we'll test with the current user and document the limitation
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {
        userType,
        email: userConfig.email,
        authResult: 'failed',
        tests: [],
        overallPassed: false
      };
    }

    // Test diagnostic page access
    const diagTest = await testDiagnosticPage(userConfig.expectedStatus);
    tests.push(diagTest);

    // Test all admin endpoints
    for (const endpoint of ADMIN_ENDPOINTS) {
      const result = await testEndpoint(
        endpoint.name,
        endpoint.method,
        endpoint.body,
        userConfig.expectedStatus
      );
      tests.push(result);
    }

    const overallPassed = tests.every(test => test.passed);

    return {
      userType,
      email: user.email || userConfig.email,
      authResult: 'success',
      tests,
      overallPassed
    };
  };

  const runFullTestSuite = async () => {
    setIsRunning(true);
    setResults([]);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Error',
          description: 'Must be authenticated to run tests',
          variant: 'destructive'
        });
        return;
      }

      setCurrentUser(user.email || 'Unknown');

      // Check if current user is superadmin
      const { data: isSuperadmin } = await supabase.rpc('is_superadmin');
      
      if (isSuperadmin) {
        // Test as superadmin
        const superadminResults = await runTestsForUser('superadmin');
        setResults([superadminResults]);
        
        toast({
          title: 'Test Complete',
          description: `Tested as superadmin. ${superadminResults.overallPassed ? 'All tests passed' : 'Some tests failed'}`,
          variant: superadminResults.overallPassed ? 'default' : 'destructive'
        });
      } else {
        // Test as non-superadmin
        const nonSuperadminResults = await runTestsForUser('non-superadmin');
        setResults([nonSuperadminResults]);
        
        toast({
          title: 'Test Complete',
          description: `Tested as non-superadmin. ${nonSuperadminResults.overallPassed ? 'All tests passed' : 'Some tests failed'}`,
          variant: nonSuperadminResults.overallPassed ? 'default' : 'destructive'
        });
      }
    } catch (error) {
      console.error('Test suite error:', error);
      toast({
        title: 'Test Suite Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (passed: boolean) => {
    return passed ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (actualStatus: number, expectedStatus: number) => {
    const passed = actualStatus === expectedStatus;
    return (
      <Badge variant={passed ? 'default' : 'destructive'}>
        {actualStatus} {passed ? '✓' : `(expected ${expectedStatus})`}
      </Badge>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Superadmin Authorization Test Harness
        </CardTitle>
        <CardDescription>
          Validates that admin endpoints return 200 for superadmins and 403 for non-superadmins.
          Currently testing as: {currentUser || 'Not authenticated'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runFullTestSuite} 
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Authorization Tests
              </>
            )}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          <p><strong>Note:</strong> This test validates the current user's access. To test both superadmin and non-superadmin scenarios, run this test while signed in as each user type.</p>
        </div>

        {results.length > 0 && (
          <div className="space-y-4">
            {results.map((result, index) => (
              <Card key={index} className="border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {result.userType === 'superadmin' ? 'Superadmin' : 'Non-Superadmin'} Tests
                    </CardTitle>
                    <Badge variant={result.overallPassed ? 'default' : 'destructive'}>
                      {result.overallPassed ? 'PASS' : 'FAIL'}
                    </Badge>
                  </div>
                  <CardDescription>
                    Email: {result.email} | Auth: {result.authResult}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {result.tests.map((test, testIndex) => (
                      <div key={testIndex} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(test.passed)}
                          <span className="font-mono text-sm">{test.method}</span>
                          <span className="text-sm">{test.endpoint}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(test.actualStatus, test.expectedStatus)}
                          {test.error && (
                            <span className="text-xs text-muted-foreground max-w-32 truncate" title={test.error}>
                              {test.error}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}