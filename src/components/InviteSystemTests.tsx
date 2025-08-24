import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Play, Loader2, AlertTriangle, ShieldAlert } from "lucide-react";
import { runAllTests, TestSuite, TestResult, getTestLevel, isTestingEnabled, areWriteTestsEnabled, isTestSetupValid, getTestOrgId } from "@/lib/invite-tests";
import { useToast } from "@/hooks/use-toast";

interface InviteSystemTestsProps {
  organizationId?: string;
}

export function InviteSystemTests({ organizationId }: InviteSystemTestsProps) {
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestSuite[]>([]);
  const { toast } = useToast();
  
  const testLevel = getTestLevel();
  const testingEnabled = isTestingEnabled();
  const writeTestsEnabled = areWriteTestsEnabled();
  const testSetup = isTestSetupValid();
  const testOrgId = getTestOrgId();

  const runTests = async () => {
    if (!testSetup.valid) {
      toast({
        title: "Test Setup Invalid",
        description: testSetup.message || "Please configure test environment properly",
        variant: "destructive"
      });
      return;
    }
    
    setTesting(true);
    setTestResults([]);
    
    try {
      // Always use configured test org, ignore passed organizationId
      const results = await runAllTests();
      setTestResults(results);
      
      const allPassed = results.every(suite => suite.passed);
      toast({
        title: allPassed ? "All Tests Passed!" : "Some Tests Failed",
        description: `${results.filter(s => s.passed).length}/${results.length} test suites passed`,
        variant: allPassed ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Test execution failed:', error);
      toast({
        title: "Test Execution Failed",
        description: `Error running tests: ${error}`,
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const getResultIcon = (passed: boolean) => {
    return passed ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );
  };

  const getResultBadge = (passed: boolean) => {
    return (
      <Badge variant={passed ? "default" : "destructive"}>
        {passed ? "PASS" : "FAIL"}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {!testSetup.valid && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            {testSetup.message}
          </AlertDescription>
        </Alert>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Invite System Security Tests
            <Badge variant="outline" className="text-xs">
              Test Org: {testOrgId || 'Not Configured'}
            </Badge>
          </CardTitle>
          <CardDescription>
            Automated tests to verify invite system security, permissions, and data integrity.
            {testLevel === 'smoke' && ' Running in read-only mode with dedicated test organization.'}
            {testLevel === 'full' && ' Running complete test suite with dedicated test organization.'}
            {!testSetup.valid && ' Testing configuration required.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={runTests}
            disabled={testing || !testSetup.valid}
            className="w-full"
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : !testSetup.valid ? (
              <>
                <ShieldAlert className="h-4 w-4 mr-2" />
                Setup Required
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run {testLevel === 'smoke' ? 'Smoke' : 'All Security'} Tests
              </>
            )}
          </Button>
          
          {testSetup.valid && testOrgId && (
            <Alert className="mt-4">
              <AlertDescription>
                Using dedicated test organization: <code className="bg-muted px-1 rounded">{testOrgId}</code>
                <span className="block mt-1 text-sm text-muted-foreground">
                  {testLevel === 'smoke' && 'Read-only operations only. '}
                  Email delivery disabled for tests.
                </span>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Test Results</h3>
            <div className="flex items-center gap-2">
              {getResultIcon(testResults.every(s => s.passed))}
              <span className="text-sm text-muted-foreground">
                {testResults.filter(s => s.passed).length}/{testResults.length} suites passed
              </span>
            </div>
          </div>

          {testResults.map((suite, suiteIndex) => (
            <Card key={suiteIndex}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{suite.suiteName}</CardTitle>
                  <div className="flex items-center gap-2">
                    {getResultBadge(suite.passed)}
                    <span className="text-sm text-muted-foreground">
                      {suite.summary}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {suite.results.map((result, resultIndex) => (
                  <div key={resultIndex}>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="mt-0.5">
                        {getResultIcon(result.passed)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-medium text-sm">{result.testName}</h4>
                          {getResultBadge(result.passed)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {result.message}
                        </p>
                        {result.details && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              Show details
                            </summary>
                            <pre className="text-xs bg-background p-2 rounded border mt-1 overflow-auto">
                              {JSON.stringify(result.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                    {resultIndex < suite.results.length - 1 && (
                      <Separator className="my-2" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!testing && testResults.length === 0 && testSetup.valid && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Click "Run {testLevel === 'smoke' ? 'Smoke' : 'All Security'} Tests" to verify your invite system security.</p>
              {testLevel === 'smoke' && (
                <p className="text-xs mt-2">Running in read-only mode - no data will be modified.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}