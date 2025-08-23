import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Play, Loader2, AlertTriangle } from "lucide-react";
import { runAllTests, TestSuite, TestResult } from "@/lib/invite-tests";
import { useToast } from "@/hooks/use-toast";

interface InviteSystemTestsProps {
  organizationId?: string;
}

export function InviteSystemTests({ organizationId }: InviteSystemTestsProps) {
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestSuite[]>([]);
  const { toast } = useToast();

  const runTests = async () => {
    setTesting(true);
    setTestResults([]);
    
    try {
      const results = await runAllTests(organizationId);
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Invite System Security Tests
          </CardTitle>
          <CardDescription>
            Automated tests to verify invite system security, permissions, and data integrity.
            These tests validate admin permissions, member restrictions, invite flow, and role enforcement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={runTests}
            disabled={testing}
            className="w-full"
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run All Security Tests
              </>
            )}
          </Button>
          
          {organizationId && (
            <Alert className="mt-4">
              <AlertDescription>
                Testing with organization ID: <code className="bg-muted px-1 rounded">{organizationId}</code>
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

      {!testing && testResults.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Click "Run All Security Tests" to verify your invite system security.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}