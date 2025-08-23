import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, XCircle, Mail, Loader2 } from 'lucide-react';

export default function InviteAcceptPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    organizationName?: string;
    role?: string;
  } | null>(null);

  const token = searchParams.get('token');

  useEffect(() => {
    // Redirect to auth if not logged in
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    // Process invitation if user is authenticated and token exists
    if (!authLoading && user && token && !result && !processing) {
      processInvitation();
    }
  }, [user, authLoading, token, result, processing]);

  const processInvitation = async () => {
    if (!token) {
      setResult({
        success: false,
        message: 'Invalid invitation link. No token provided.'
      });
      return;
    }

    setProcessing(true);

    try {
      const { data, error } = await supabase.rpc('accept_invite', {
        p_token: token
      });

      if (error) {
        throw error;
      }

      const result = data as any;
      if (result?.success) {
        // Get organization name for display
        const { data: orgData } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', result.organization_id)
          .single();

        setResult({
          success: true,
          message: result.message,
          organizationName: orgData?.name,
          role: result.role
        });

        toast({
          title: "Welcome to the team!",
          description: `You have successfully joined ${orgData?.name || 'the organization'}`,
        });

        // Redirect to teams settings after a delay
        setTimeout(() => {
          navigate('/settings/teams');
        }, 2000);
      } else {
        setResult({
          success: false,
          message: result?.error || 'Failed to accept invitation'
        });
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestNewInvite = () => {
    toast({
      title: "Contact your admin",
      description: "Please contact your organization administrator to request a new invitation.",
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <XCircle className="h-6 w-6 text-destructive" />
              Invalid Invitation
            </CardTitle>
            <CardDescription>
              This invitation link is invalid or missing required information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Please check your invitation email and use the correct link, or contact your organization administrator.
            </p>
            <Button 
              onClick={() => navigate('/dashboard')} 
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              Processing Invitation
            </CardTitle>
            <CardDescription>
              Please wait while we process your invitation...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              {result.success ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-500" />
                  Invitation Accepted!
                </>
              ) : (
                <>
                  <XCircle className="h-6 w-6 text-destructive" />
                  Invitation Failed
                </>
              )}
            </CardTitle>
            <CardDescription>
              {result.success 
                ? `Welcome to ${result.organizationName || 'the organization'}!`
                : 'There was a problem with your invitation'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-center">
              {result.message}
            </p>
            
            {result.success && result.role && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Your role: <span className="font-medium capitalize">{result.role}</span>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Redirecting to team settings...
                </p>
              </div>
            )}

            <div className="space-y-2">
              {result.success ? (
                <Button 
                  onClick={() => navigate('/settings/teams')} 
                  className="w-full"
                >
                  Go to Team Settings
                </Button>
              ) : (
                <>
                  <Button 
                    onClick={handleRequestNewInvite}
                    className="w-full"
                    variant="outline"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Request New Invite
                  </Button>
                  <Button 
                    onClick={() => navigate('/dashboard')} 
                    className="w-full"
                  >
                    Go to Dashboard
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}