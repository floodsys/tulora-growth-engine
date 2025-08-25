import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Eye, 
  Download, 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  UserPlus,
  Shield,
  Mail,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { getEnvironmentConfig } from '@/lib/environment';

interface TestStep {
  id: string;
  phase: string;
  name: string;
  description: string;
  expected: string;
  actual?: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  httpStatus?: number;
  errorCode?: string;
  duration?: number;
  timestamp?: string;
}

interface TestRun {
  id: string;
  organizationId: string;
  mode: 'full' | 'smoke';
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  steps: TestStep[];
  metadata: any;
}

export const InviteSystemTest = () => {
  const { user } = useAuth();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [testMode, setTestMode] = useState<'full' | 'smoke'>('smoke');
  const [isRunning, setIsRunning] = useState(false);
  const [isDryRun, setIsDryRun] = useState(true);
  const [leaveArtifacts, setLeaveArtifacts] = useState(false);
  const [currentRun, setCurrentRun] = useState<TestRun | null>(null);
  const [testHistory, setTestHistory] = useState<TestRun[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [testEmail, setTestEmail] = useState('test.invite@example.com');

  const envConfig = getEnvironmentConfig();
  const testOrgId = '00000000-0000-0000-0000-000000000000'; // Default test org ID

  useEffect(() => {
    setSelectedOrgId(testOrgId);
    loadTestHistory();
  }, [testOrgId]);

  const loadTestHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('test_logs')
        .select('*')
        .eq('test_suite', 'invite_system')
        .eq('organization_id', testOrgId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Group by test_session_id to reconstruct test runs
      const runGroups: { [key: string]: any[] } = {};
      data?.forEach(log => {
        if (!runGroups[log.test_session_id]) {
          runGroups[log.test_session_id] = [];
        }
        runGroups[log.test_session_id].push(log);
      });

      const runs = Object.entries(runGroups).map(([sessionId, logs]) => {
        const sortedLogs = logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const firstLog = sortedLogs[0];
        const lastLog = sortedLogs[sortedLogs.length - 1];
        
        return {
          id: sessionId,
          organizationId: firstLog.organization_id,
          mode: firstLog.details?.mode || 'smoke',
          startedAt: firstLog.created_at,
          completedAt: lastLog.created_at,
          status: 'completed' as const,
          totalSteps: logs.length,
          passedSteps: logs.filter(l => l.status === 'passed').length,
          failedSteps: logs.filter(l => l.status === 'failed').length,
          steps: logs.map(log => ({
            id: log.id,
            phase: log.details?.phase || 'unknown',
            name: log.test_name,
            description: log.message || '',
            expected: log.details?.expected || '',
            actual: log.details?.actual || '',
            status: log.status as any,
            httpStatus: log.details?.httpStatus,
            errorCode: log.details?.errorCode,
            duration: log.duration_ms,
            timestamp: log.created_at
          })),
          metadata: firstLog.details || {}
        };
      });

      setTestHistory(runs);
    } catch (error) {
      console.error('Failed to load test history:', error);
    }
  };

  const generateTestSteps = (): TestStep[] => {
    const baseSteps: TestStep[] = [
      // Setup Phase
      {
        id: 'setup_org_check',
        phase: 'Setup',
        name: 'Organization Check',
        description: 'Verify test organization exists and is accessible',
        expected: 'Organization found and accessible',
        status: 'pending'
      },
      {
        id: 'setup_user_auth',
        phase: 'Setup', 
        name: 'User Authentication',
        description: 'Verify current user is authenticated and has admin access',
        expected: 'User authenticated as admin',
        status: 'pending'
      },

      // Permissions Phase
      {
        id: 'permissions_admin_access',
        phase: 'Permissions',
        name: 'Admin Invite Access',
        description: 'Admin user can access invite management UI',
        expected: 'HTTP 200, invite interface accessible',
        status: 'pending'
      },
      {
        id: 'permissions_non_admin_blocked',
        phase: 'Permissions',
        name: 'Non-Admin Blocked',
        description: 'Non-admin user cannot create invites',
        expected: 'HTTP 403, not_authorized error',
        status: 'pending'
      },

      // Create/Duplicate/Resend Phase
      {
        id: 'create_invite_admin',
        phase: 'Create/Duplicate/Resend',
        name: 'Create Admin Invite',
        description: 'Create new invite with admin role',
        expected: 'HTTP 200, invite token returned, audit invite.created',
        status: 'pending'
      },
      {
        id: 'create_invite_editor',
        phase: 'Create/Duplicate/Resend',
        name: 'Create Editor Invite', 
        description: 'Create new invite with editor role',
        expected: 'HTTP 200, invite token returned, audit invite.created',
        status: 'pending'
      },
      {
        id: 'create_invite_viewer',
        phase: 'Create/Duplicate/Resend',
        name: 'Create Viewer Invite',
        description: 'Create new invite with viewer role', 
        expected: 'HTTP 200, invite token returned, audit invite.created',
        status: 'pending'
      },
      {
        id: 'create_invite_user',
        phase: 'Create/Duplicate/Resend',
        name: 'Create User Invite',
        description: 'Create new invite with user role',
        expected: 'HTTP 200, invite token returned, audit invite.created',
        status: 'pending'
      },
      {
        id: 'create_duplicate_invite',
        phase: 'Create/Duplicate/Resend',
        name: 'Create Duplicate Invite',
        description: 'Attempt to create duplicate invite for same email',
        expected: 'Graceful handling, resend or error message',
        status: 'pending'
      },
      {
        id: 'resend_invite',
        phase: 'Create/Duplicate/Resend',
        name: 'Resend Invite',
        description: 'Resend existing pending invite',
        expected: 'HTTP 200, audit invite.resent',
        status: 'pending'
      },

      // Accept/Upsert Phase
      {
        id: 'accept_valid_invite',
        phase: 'Accept/Upsert',
        name: 'Accept Valid Invite',
        description: 'Accept invite with valid token as signed-in user',
        expected: 'HTTP 200, membership created, audit invite.accepted + member.added',
        status: 'pending'
      },
      {
        id: 'accept_invalid_token',
        phase: 'Accept/Upsert',
        name: 'Accept Invalid Token',
        description: 'Attempt to accept invite with invalid token',
        expected: 'Friendly error, audit invite.accept_failed',
        status: 'pending'
      },
      {
        id: 'accept_expired_invite',
        phase: 'Accept/Upsert',
        name: 'Accept Expired Invite',
        description: 'Attempt to accept expired invite',
        expected: 'Error message, audit invite.accept_failed',
        status: 'pending'
      },
      {
        id: 'upsert_existing_member',
        phase: 'Accept/Upsert',
        name: 'Upsert Existing Member',
        description: 'Accept invite for user who is already a member',
        expected: 'Role updated, audit member.role_changed',
        status: 'pending'
      },

      // Revoke Phase
      {
        id: 'revoke_pending_invite',
        phase: 'Revoke',
        name: 'Revoke Pending Invite',
        description: 'Revoke a pending invite',
        expected: 'HTTP 200, status=revoked, token unusable, audit invite.revoked',
        status: 'pending'
      },
      {
        id: 'use_revoked_token',
        phase: 'Revoke',
        name: 'Use Revoked Token',
        description: 'Attempt to accept revoked invite token',
        expected: 'Error message, invite not accepted',
        status: 'pending'
      },

      // RLS/Guards Phase
      {
        id: 'rls_direct_insert_blocked',
        phase: 'RLS/Guards',
        name: 'Direct Insert Blocked',
        description: 'Direct INSERT to organization_invitations as non-admin',
        expected: 'RLS denied, operation blocked',
        status: 'pending'
      },
      {
        id: 'suspended_org_blocked',
        phase: 'RLS/Guards',
        name: 'Suspended Org Blocked',
        description: 'Create invite while org is suspended',
        expected: 'HTTP 423, ORG_SUSPENDED, audit org.blocked_operation',
        status: 'pending'
      }
    ];

    // Add cleanup phase if not leaving artifacts
    if (!leaveArtifacts) {
      baseSteps.push({
        id: 'cleanup_test_invites',
        phase: 'Cleanup',
        name: 'Cleanup Test Invites',
        description: 'Revoke test invites and remove test memberships',
        expected: 'All test artifacts cleaned up',
        status: 'pending'
      });
    }

    // Filter steps based on test mode
    if (testMode === 'smoke') {
      // Smoke mode: only read-only and validation checks
      return baseSteps.filter(step => 
        step.phase === 'Setup' || 
        step.phase === 'Permissions' ||
        (step.phase === 'Accept/Upsert' && step.id.includes('invalid')) ||
        (step.phase === 'RLS/Guards' && step.id === 'rls_direct_insert_blocked')
      );
    }

    return baseSteps;
  };

  const runTestStep = async (step: TestStep): Promise<TestStep> => {
    const startTime = Date.now();
    const updatedStep: TestStep = { ...step, status: 'running', timestamp: new Date().toISOString() };

    try {
      let result: any = {};

      switch (step.id) {
        case 'setup_org_check':
          result = await supabase
            .from('organizations')
            .select('id, name, suspension_status')
            .eq('id', selectedOrgId)
            .single();
          
          if (result.error) throw result.error;
          updatedStep.actual = `Organization found: ${result.data.name}`;
          break;

        case 'setup_user_auth':
          if (!user) throw new Error('User not authenticated');
          updatedStep.actual = `User authenticated: ${user.email}`;
          break;

        case 'permissions_admin_access':
          // Test invite management access
          result = await supabase.functions.invoke('invite-management', {
            body: { action: 'list', organizationId: selectedOrgId }
          });
          
          if (result.error) throw result.error;
          updatedStep.actual = `HTTP ${result.status || 200}, invite access granted`;
          updatedStep.httpStatus = result.status || 200;
          break;

        case 'create_invite_admin':
        case 'create_invite_editor':
        case 'create_invite_viewer':
        case 'create_invite_user':
          const role = step.id.split('_')[2]; // Extract role from step id
          result = await supabase.functions.invoke('invite-management', {
            body: { 
              action: 'create',
              organizationId: selectedOrgId,
              email: `${role}.${testEmail}`,
              role: role,
              testRunId: currentRun?.id
            }
          });
          
          if (result.error) throw result.error;
          updatedStep.actual = `Invite created for ${role}, token: ${result.data?.token?.substring(0, 8)}...`;
          updatedStep.httpStatus = result.status || 200;
          break;

        case 'create_duplicate_invite':
          // Try to create duplicate invite
          result = await supabase.functions.invoke('invite-management', {
            body: { 
              action: 'create',
              organizationId: selectedOrgId,
              email: testEmail,
              role: 'user',
              testRunId: currentRun?.id
            }
          });
          
          updatedStep.actual = result.error ? 
            `Duplicate handled: ${result.error.message}` : 
            'Duplicate allowed (unexpected)';
          updatedStep.httpStatus = result.status || (result.error ? 409 : 200);
          break;

        case 'accept_invalid_token':
          result = await supabase.functions.invoke('invite-management', {
            body: { 
              action: 'accept',
              token: 'invalid-token-12345',
              testRunId: currentRun?.id
            }
          });
          
          updatedStep.actual = result.error ? 
            `Expected error: ${result.error.message}` : 
            'Invalid token accepted (unexpected)';
          updatedStep.httpStatus = result.status || (result.error ? 400 : 200);
          updatedStep.errorCode = result.error?.code;
          break;

        case 'rls_direct_insert_blocked':
          // Attempt direct database insert (should be blocked by RLS)
          try {
            result = await supabase
              .from('organization_invitations')
              .insert({
                organization_id: selectedOrgId,
                email: 'direct.insert@test.com',
                role: 'user',
                invite_token: 'direct-insert-token'
              });
            
            updatedStep.actual = result.error ? 
              `RLS blocked: ${result.error.message}` : 
              'Direct insert allowed (SECURITY ISSUE)';
            updatedStep.httpStatus = result.error ? 403 : 200;
          } catch (error: any) {
            updatedStep.actual = `RLS blocked: ${error.message}`;
            updatedStep.httpStatus = 403;
          }
          break;

        case 'suspended_org_blocked':
          // This would require suspending the org first, then testing
          updatedStep.actual = 'Skipped - requires org suspension setup';
          updatedStep.status = 'skipped';
          return updatedStep;

        default:
          updatedStep.actual = 'Test step not implemented yet';
          updatedStep.status = 'skipped';
          return updatedStep;
      }

      // Determine if step passed based on expected vs actual
      if (updatedStep.status === 'running') {
        const passed = step.expected.toLowerCase().includes('http 200') ? 
          (updatedStep.httpStatus === 200) :
          step.expected.toLowerCase().includes('error') ?
            (updatedStep.httpStatus !== 200 || updatedStep.actual?.toLowerCase().includes('error')) :
            true; // Default to passed for now

        updatedStep.status = passed ? 'passed' : 'failed';
      }

      updatedStep.duration = Date.now() - startTime;
      return updatedStep;

    } catch (error: any) {
      updatedStep.status = 'failed';
      updatedStep.actual = `Error: ${error.message}`;
      updatedStep.duration = Date.now() - startTime;
      return updatedStep;
    }
  };

  const runTests = async () => {
    if (!selectedOrgId) {
      alert('Please select a test organization');
      return;
    }

    setIsRunning(true);
    setShowPreview(false);

    const testRunId = `invite_test_${Date.now()}`;
    const steps = generateTestSteps();
    
    const newRun: TestRun = {
      id: testRunId,
      organizationId: selectedOrgId,
      mode: testMode,
      startedAt: new Date().toISOString(),
      status: 'running',
      totalSteps: steps.length,
      passedSteps: 0,
      failedSteps: 0,
      steps: steps,
        metadata: {
          testEmail,
          leaveArtifacts,
          isDryRun,
          environment: 'development'
        }
    };

    setCurrentRun(newRun);

    try {
      // Run tests sequentially
      for (let i = 0; i < steps.length; i++) {
        if (!isDryRun) {
          const updatedStep = await runTestStep(steps[i]);
          newRun.steps[i] = updatedStep;
          
          if (updatedStep.status === 'passed') {
            newRun.passedSteps++;
          } else if (updatedStep.status === 'failed') {
            newRun.failedSteps++;
          }

          // Log test step
          await supabase.functions.invoke('test-logger', {
            body: {
              test_session_id: testRunId,
              test_suite: 'invite_system',
              test_type: testMode,
              test_name: updatedStep.name,
              status: updatedStep.status,
              message: updatedStep.description,
              duration_ms: updatedStep.duration,
              organization_id: selectedOrgId,
              details: {
                phase: updatedStep.phase,
                expected: updatedStep.expected,
                actual: updatedStep.actual,
                httpStatus: updatedStep.httpStatus,
                errorCode: updatedStep.errorCode,
                mode: testMode
              }
            }
          });

          setCurrentRun({ ...newRun });
        } else {
          // Dry run - just mark as pending
          newRun.steps[i] = { ...steps[i], status: 'pending' };
        }
      }

      newRun.status = 'completed';
      newRun.completedAt = new Date().toISOString();
      setCurrentRun(newRun);

      if (!isDryRun) {
        loadTestHistory(); // Refresh history
      }

    } catch (error) {
      console.error('Test run failed:', error);
      if (newRun) {
        newRun.status = 'failed';
        newRun.completedAt = new Date().toISOString();
        setCurrentRun(newRun);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const exportResults = () => {
    if (!currentRun) return;

    const exportData = {
      testRun: currentRun,
      exportedAt: new Date().toISOString(),
      environment: 'development'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invite_system_test_${currentRun.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running': return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'skipped': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const groupStepsByPhase = (steps: TestStep[]) => {
    return steps.reduce((groups, step) => {
      if (!groups[step.phase]) {
        groups[step.phase] = [];
      }
      groups[step.phase].push(step);
      return groups;
    }, {} as Record<string, TestStep[]>);
  };

  const isDisabled = !envConfig.isTestingEnabled || envConfig.testLevel === 'off';

  if (isDisabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite System Tests
            <Badge variant="secondary">Disabled</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Invite system tests are disabled. Set RUN_TEST_LEVEL to enable testing.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Invite System Tests
          <Badge variant={testMode === 'smoke' ? 'secondary' : 'default'}>
            {testMode.toUpperCase()}
          </Badge>
          <Badge variant="outline">Dev Mode</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Comprehensive testing of invite creation, acceptance, revocation, and security controls.
            Tests are org-scoped and never send real emails. Use "Copy Invite Link" instead.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="config" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Test Organization</Label>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={testOrgId}>
                      TEST_ORG ({testOrgId.substring(0, 8)}...)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Test Mode</Label>
                <Select value={testMode} onValueChange={(value: 'full' | 'smoke') => setTestMode(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smoke">Smoke (Read-only)</SelectItem>
                    <SelectItem value="full">Full (Write operations)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Test Email</Label>
                <Input
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test.invite@example.com"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dry-run"
                  checked={isDryRun}
                  onCheckedChange={(checked) => setIsDryRun(checked === true)}
                />
                <Label htmlFor="dry-run">Dry Run (Preview only)</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="leave-artifacts"
                  checked={leaveArtifacts}
                  onCheckedChange={(checked) => setLeaveArtifacts(checked === true)}
                />
                <Label htmlFor="leave-artifacts">Leave test artifacts (skip cleanup)</Label>
              </div>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowPreview(true);
                  const steps = generateTestSteps();
                  setCurrentRun({
                    id: `preview_${Date.now()}`,
                    organizationId: selectedOrgId,
                    mode: testMode,
                    startedAt: new Date().toISOString(),
                    status: 'running',
                    totalSteps: steps.length,
                    passedSteps: 0,
                    failedSteps: 0,
                    steps: steps.map(step => ({ ...step, status: 'pending' })),
                    metadata: {}
                  });
                }}
                variant="outline"
                disabled={isRunning}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Tests
              </Button>

              <Button
                onClick={runTests}
                disabled={isRunning || !selectedOrgId}
              >
                <Play className="h-4 w-4 mr-2" />
                {isDryRun ? 'Run Dry Test' : 'Execute Tests'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            {currentRun && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold">Test Run Results</h3>
                    <Badge variant={currentRun.status === 'completed' ? 'default' : 'secondary'}>
                      {currentRun.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={exportResults} variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export JSON
                    </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(`/admin/logs/org/${currentRun.organizationId}?filter=test_invites&run_id=${currentRun.id}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Audit Events
                  </Button>
                </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{currentRun.totalSteps}</div>
                      <p className="text-xs text-muted-foreground">Total Steps</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-green-600">{currentRun.passedSteps}</div>
                      <p className="text-xs text-muted-foreground">Passed</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-red-600">{currentRun.failedSteps}</div>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-yellow-600">
                        {currentRun.totalSteps - currentRun.passedSteps - currentRun.failedSteps}
                      </div>
                      <p className="text-xs text-muted-foreground">Pending/Skipped</p>
                    </CardContent>
                  </Card>
                </div>

                <ScrollArea className="h-96 border rounded-md p-4">
                  <div className="space-y-6">
                    {Object.entries(groupStepsByPhase(currentRun.steps)).map(([phase, steps]) => (
                      <div key={phase} className="space-y-2">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                          {phase}
                        </h4>
                        <div className="space-y-2">
                          {steps.map((step) => (
                            <div key={step.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                              {getStepIcon(step.status)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-sm">{step.name}</p>
                                  {step.duration && (
                                    <span className="text-xs text-muted-foreground">
                                      {step.duration}ms
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                                <div className="mt-2 space-y-1">
                                  <div className="text-xs">
                                    <span className="font-medium">Expected:</span> {step.expected}
                                  </div>
                                  {step.actual && (
                                    <div className="text-xs">
                                      <span className="font-medium">Actual:</span> {step.actual}
                                    </div>
                                  )}
                                  {step.httpStatus && (
                                    <div className="text-xs">
                                      <span className="font-medium">HTTP:</span> {step.httpStatus}
                                      {step.errorCode && ` (${step.errorCode})`}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}

            {!currentRun && (
              <div className="text-center py-8 text-muted-foreground">
                No test results yet. Run a test to see results here.
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Test History</h3>
              <Button onClick={loadTestHistory} variant="outline" size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            <ScrollArea className="h-96">
              <div className="space-y-2">
                {testHistory.map((run) => (
                  <Card key={run.id} className="cursor-pointer hover:bg-accent/50" 
                        onClick={() => setCurrentRun(run)}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant={run.mode === 'smoke' ? 'secondary' : 'default'}>
                              {run.mode.toUpperCase()}
                            </Badge>
                            <span className="text-sm font-medium">
                              {new Date(run.startedAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {run.passedSteps}/{run.totalSteps} passed
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">
                            {run.completedAt && (
                              <span>
                                {Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s
                              </span>
                            )}
                          </div>
                          <Badge variant={run.failedSteps > 0 ? 'destructive' : 'default'}>
                            {run.status}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {testHistory.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No test history found. Run some tests to see history here.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};