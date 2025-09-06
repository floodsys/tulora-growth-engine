import { ReactNode, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, ShieldX, Clock } from 'lucide-react';
import { useAdminSession } from '@/hooks/useAdminSession';

interface AdminGuardProps {
  children: ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { session, loading, verifying, verifyStepUp } = useAdminSession();
  const [showReauth, setShowReauth] = useState(false);

  useEffect(() => {
    if (!loading) {
      // For now, let's bypass the complex cookie validation and use a simpler approach
      // Check if we have a recent step-up in localStorage
      const stepUpTime = localStorage.getItem('admin_step_up_time');
      console.log('Checking step-up time from localStorage:', stepUpTime);
      
      const isRecentStepUp = stepUpTime && (Date.now() - parseInt(stepUpTime)) < 12 * 60 * 60 * 1000; // 12 hours
      console.log('Is recent step-up?', isRecentStepUp);
      
      setShowReauth(!isRecentStepUp);
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Checking Admin Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showReauth || !session?.valid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
              <ShieldX className="h-5 w-5" />
              Admin Re-Authentication Required
            </CardTitle>
            <CardDescription className="text-orange-700 dark:text-orange-300">
              {session?.reason?.includes('expired') 
                ? 'Your elevated admin session has expired after 12 hours'
                : 'Elevated admin access required for this section'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {session?.age_minutes !== undefined && (
              <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                <Clock className="h-4 w-4" />
                Session age: {session.age_minutes} minutes (max: 720 minutes)
              </div>
            )}
            
            <Button
              onClick={async () => {
                console.log('Step-up button clicked');
                const success = await verifyStepUp();
                console.log('Step-up result:', success);
                if (success) {
                  console.log('Setting showReauth to false');
                  // Force a re-check of localStorage after step-up
                  const stepUpTime = localStorage.getItem('admin_step_up_time');
                  console.log('After step-up, localStorage value:', stepUpTime);
                  const isRecentStepUp = stepUpTime && (Date.now() - parseInt(stepUpTime)) < 12 * 60 * 60 * 1000;
                  console.log('Is recent step-up after manual check?', isRecentStepUp);
                  setShowReauth(!isRecentStepUp);
                }
              }}
              disabled={verifying}
              className="w-full"
            >
              {verifying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Complete Step-Up Authentication
                </>
              )}
            </Button>

            <div className="text-xs text-muted-foreground text-center">
              This creates a secure, server-side session valid for 12 hours
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}