import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CheckCircle, XCircle, Play, Loader2, AlertTriangle, ShieldAlert, ChevronDown, Zap, Settings } from "lucide-react";
import { runAllTests, TestSuite, TestResult, getTestLevel, isTestingEnabled, areWriteTestsEnabled, isTestSetupValid, getTestOrgId, testReadOnlyAccess } from "@/lib/invite-tests";
import { TestLogViewer } from "./TestLogViewer";
import { useToast } from "@/hooks/use-toast";

interface InviteSystemTestsProps {
  organizationId?: string;
}

export function InviteSystemTests({ organizationId }: InviteSystemTestsProps) {
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestSuite[]>([]);
  const [selectedTestMode, setSelectedTestMode] = useState<'smoke' | 'full'>('smoke');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const { toast } = useToast();
  
  const testLevel = getTestLevel();
  const testingEnabled = isTestingEnabled();
  const writeTestsEnabled = areWriteTestsEnabled();
  const testSetup = isTestSetupValid();
  const testOrgId = getTestOrgId();

  // Auto-select based on test level  
  useEffect(() => {
    if (testLevel === 'full') {
      setSelectedTestMode('full');
    } else {
      setSelectedTestMode('smoke');
    }
  }, [testLevel]);

  const canRunSelectedMode = () => {
    if (selectedTestMode === 'full' && testLevel !== 'full') {
      return false;
    }
    return true;
  };

  const runTests = async () => {
    if (!testSetup.valid) {
      toast({
        title: "Test Setup Invalid",
        description: testSetup.message || "Please configure test environment properly",
        variant: "destructive"
      });
      return;
    }

    if (!canRunSelectedMode()) {
      toast({
        title: "Insufficient Test Level",
        description: `Cannot run ${selectedTestMode} tests with RUN_TEST_LEVEL=${testLevel}. Set RUN_TEST_LEVEL=full to run full test suite.`,
        variant: "destructive"
      });
      return;
    }

    // Additional safety check for production
    if (testLevel === 'smoke' && selectedTestMode === 'full') {
      toast({
        title: "Action Blocked",
        description: "Full test suite is disabled in smoke mode. Only read-only tests are allowed.",
        variant: "destructive"
      });
      return;
    }
    
    setTesting(true);
    setTestResults([]);
    setShowConfirmModal(false);
    
    try {
      // Run tests based on selected mode, overriding environment level
      const results = selectedTestMode === 'smoke' 
        ? [await testReadOnlyAccess(testOrgId!)]
        : await runAllTests();
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

  const handleRunTests = () => {
    if (!canRunSelectedMode()) {
      toast({
        title: "Insufficient Test Level",
        description: `Cannot run ${selectedTestMode} tests with RUN_TEST_LEVEL=${testLevel}. Set RUN_TEST_LEVEL=full to run full test suite.`,
        variant: "destructive"
      });
      return;
    }

    // Additional safety check for production
    if (testLevel === 'smoke' && selectedTestMode === 'full') {
      toast({
        title: "Action Blocked",
        description: "Full test suite is disabled in smoke mode. Only read-only tests are allowed.",
        variant: "destructive"
      });
      return;
    }
    
    setShowConfirmModal(true);
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

  const getTestModeInfo = (mode: 'smoke' | 'full') => {
    switch (mode) {
      case 'smoke':
        return {
          label: 'Smoke (Prod)',
          description: 'Read-only validation tests safe for production',
          icon: <Settings className="h-4 w-4" />,
          effects: [
            'Validates test environment configuration',
            'Reads organization and member data',
            'Reads existing invitations',
            'No data creation or modification',
            'Safe for production use'
          ]
        };
      case 'full':
        return {
          label: 'Full Suite (CI)',
          description: 'Complete test suite with write operations',
          icon: <Zap className="h-4 w-4" />,
          effects: [
            'Creates test invitations',
            'Tests invitation acceptance flow',
            'Tests role validation and normalization',
            'Tests admin and member permissions',
            'Modifies test organization data',
            'Only safe in CI/staging environments'
          ]
        };
    }
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

      {testLevel === 'smoke' && (
        <Alert className="border-amber-500 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Smoke Mode Active:</strong> Only read-only diagnostic tests are available. 
            No data will be created or modified.
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
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
              <DialogTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      disabled={testing || !testSetup.valid}
                      className="flex-1"
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
                          {getTestModeInfo(selectedTestMode).icon}
                          <span className="mr-2">Run Tests: {getTestModeInfo(selectedTestMode).label}</span>
                          <ChevronDown className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedTestMode('smoke');
                        if (canRunSelectedMode()) handleRunTests();
                      }}
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      <div className="flex flex-col">
                        <span>Smoke (Prod)</span>
                        <span className="text-xs text-muted-foreground">Read-only validation</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedTestMode('full');
                        if (canRunSelectedMode()) handleRunTests();
                      }}
                      className="flex items-center gap-2"
                      disabled={testLevel !== 'full'}
                    >
                      <Zap className="h-4 w-4" />
                      <div className="flex flex-col">
                        <span>Full Suite (CI)</span>
                        <span className="text-xs text-muted-foreground">
                          {testLevel !== 'full' ? 'Disabled in smoke mode' : 'Complete test suite'}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </DialogTrigger>
              
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {getTestModeInfo(selectedTestMode).icon}
                    Confirm Test Execution
                  </DialogTitle>
                  <DialogDescription>
                    You are about to run <strong>{getTestModeInfo(selectedTestMode).label}</strong> tests.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Test Target:</strong> {testOrgId}
                      <br />
                      <span className="text-sm text-muted-foreground">
                        Tests will run exclusively against this dedicated test organization.
                      </span>
                    </AlertDescription>
                  </Alert>
                  
                  <div>
                    <h4 className="font-medium mb-2">This test will:</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      {getTestModeInfo(selectedTestMode).effects.map((effect, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-xs mt-1">•</span>
                          {effect}
                        </li>
                      ))}
                    </ul>
                    {testLevel === 'smoke' && (
                      <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                        <strong>Production Safety:</strong> No destructive operations will be performed.
                      </div>
                    )}
                  </div>
                </div>
                
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowConfirmModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={runTests}
                    className="flex items-center gap-2"
                  >
                    {getTestModeInfo(selectedTestMode).icon}
                    Run {getTestModeInfo(selectedTestMode).label}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          {testSetup.valid && testOrgId && (
            <Alert className="mt-4">
              <AlertDescription>
                Using dedicated test organization: <code className="bg-muted px-1 rounded">{testOrgId}</code>
                <span className="block mt-1 text-sm text-muted-foreground">
                  {selectedTestMode === 'smoke' && 'Read-only operations only. '}
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
              <p>Select a test mode and click "Run Tests" to verify your invite system security.</p>
              <p className="text-xs mt-2">
                Current selection: <strong>{getTestModeInfo(selectedTestMode).label}</strong> - {getTestModeInfo(selectedTestMode).description}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Log Viewer */}
      {testOrgId && (
        <TestLogViewer organizationId={testOrgId} />
      )}
    </div>
  );
}