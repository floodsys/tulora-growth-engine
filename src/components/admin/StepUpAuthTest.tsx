import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, TestTube, AlertTriangle } from 'lucide-react';
import { useStepUpAuth } from '@/hooks/useStepUpAuth';
import { StepUpAuthModal } from './StepUpAuthModal';
import { useToast } from '@/hooks/use-toast';

export function StepUpAuthTest() {
  const [showModal, setShowModal] = useState(false);
  const [testAction, setTestAction] = useState('');
  const { hasValidSession, checkStepUpAuth, requireStepUpAuth } = useStepUpAuth();
  const { toast } = useToast();

  const handleTestAction = async (action: string) => {
    setTestAction(action);
    
    const stepUpResult = await requireStepUpAuth(action) as any;
    if (!stepUpResult?.success) {
      if (stepUpResult?.error_code === 'step_up_required') {
        setShowModal(true);
      } else {
        toast({
          title: 'Step-up Auth Failed',
          description: stepUpResult?.error || 'Failed to verify step-up authentication',
          variant: 'destructive'
        });
      }
    } else {
      toast({
        title: 'Step-up Auth Success',
        description: `Action "${action}" is authorized to proceed`,
      });
    }
  };

  const handleStepUpSuccess = () => {
    setShowModal(false);
    toast({
      title: 'Step-up Authentication Complete',
      description: `Action "${testAction}" is now authorized`,
    });
  };

  const checkCurrentStatus = async () => {
    const isValid = await checkStepUpAuth();
    toast({
      title: 'Step-up Status',
      description: isValid ? 'Valid step-up session found' : 'No valid step-up session',
      variant: isValid ? 'default' : 'destructive'
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Step-up Authentication Test
            {hasValidSession && (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <Shield className="h-3 w-3 mr-1" />
                Session Active
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Test step-up authentication for sensitive admin actions. This requires either MFA code or password re-entry.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => handleTestAction('test_suspend_organization')}
              variant="destructive"
              size="sm"
            >
              <AlertTriangle className="h-4 w-4 mr-1" />
              Test Suspend Org
            </Button>
            <Button 
              onClick={() => handleTestAction('test_plan_change')}
              variant="destructive"
              size="sm"
            >
              Test Plan Change
            </Button>
            <Button 
              onClick={() => handleTestAction('test_ownership_transfer')}
              variant="destructive"
              size="sm"
            >
              Test Ownership Transfer
            </Button>
            <Button 
              onClick={() => handleTestAction('test_api_key_revoke')}
              variant="destructive"
              size="sm"
            >
              Test API Key Revoke
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={checkCurrentStatus}
              variant="outline"
              size="sm"
            >
              Check Session Status
            </Button>
          </div>

          <div className="p-3 bg-muted rounded-lg text-sm">
            <p><strong>How it works:</strong></p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Click any test action to trigger step-up authentication</li>
              <li>Choose MFA (if set up) or password verification</li>
              <li>Valid session lasts 5 minutes for multiple actions</li>
              <li>All attempts are logged in the audit trail</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <StepUpAuthModal
        isOpen={showModal}
        onOpenChange={setShowModal}
        onSuccess={handleStepUpSuccess}
        actionName={testAction}
        actionDescription={`Testing step-up authentication for ${testAction}. This is a security verification to ensure authorized access.`}
      />
    </>
  );
}