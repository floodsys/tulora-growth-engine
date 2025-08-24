import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  SkipForward, 
  TestTube,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { runAllAdminTests, AdminTestSuite, getAdminTestLevel, isAdminTestSetupValid } from '@/lib/admin-tests';

export function AdminTestRunner() {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<AdminTestSuite | null>(null);
  const testLevel = getAdminTestLevel();
  const isSetupValid = isAdminTestSetupValid();

  const runTests = async () => {
    setIsRunning(true);
    setTestResults(null);
    
    try {
      const results = await runAllAdminTests();
      setTestResults(results);
    } catch (error) {
      console.error('Test execution failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: 'pass' | 'fail' | 'skip') => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'skip':
        return <SkipForward className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: 'pass' | 'fail' | 'skip') => {
    switch (status) {
      case 'pass':
        return 'bg-green-100 text-green-800';
      case 'fail':
        return 'bg-red-100 text-red-800';
      case 'skip':
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Admin Dashboard Tests
          <Badge variant="outline" className="ml-2">
            {testLevel.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSetupValid && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Test setup is invalid. Please ensure TEST_ORG_ID is configured.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={runTests} 
            disabled={isRunning || !isSetupValid}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <Clock className="h-4 w-4 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run {testLevel === 'smoke' ? 'Smoke' : 'Full'} Tests
              </>
            )}
          </Button>
        </div>

        {testResults && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{testResults.totalTests}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{testResults.passed}</div>
                <div className="text-sm text-muted-foreground">Passed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{testResults.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{testResults.skipped}</div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
            </div>

            <Progress 
              value={(testResults.passed / testResults.totalTests) * 100} 
              className="w-full"
            />

            <div className="space-y-2">
              <h4 className="font-medium">Test Results</h4>
              {testResults.results.map((result, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 rounded border"
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="font-medium">{result.testName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.duration && (
                      <span className="text-xs text-muted-foreground">
                        {result.duration}ms
                      </span>
                    )}
                    <Badge 
                      variant="outline" 
                      className={getStatusColor(result.status)}
                    >
                      {result.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {testResults.results.some(r => r.message) && (
              <div className="space-y-2">
                <h4 className="font-medium">Messages</h4>
                {testResults.results
                  .filter(r => r.message)
                  .map((result, index) => (
                    <div key={index} className="text-sm p-2 rounded bg-muted">
                      <strong>{result.testName}:</strong> {result.message}
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}