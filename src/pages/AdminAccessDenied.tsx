import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, Home, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function AdminAccessDenied() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Log access denied event when component mounts
  useEffect(() => {
    const logAccessDenied = async () => {
      if (user) {
        try {
          await supabase.rpc('log_event', {
            p_org_id: '00000000-0000-0000-0000-000000000000',
            p_action: 'admin.access_denied',
            p_target_type: 'admin_dashboard',
            p_actor_user_id: user.id,
            p_actor_role_snapshot: 'user',
            p_target_id: '/admin',
            p_status: 'error',
            p_error_code: 'insufficient_privileges',
            p_metadata: {
              attempted_path: '/admin',
              user_email: user.email,
              timestamp: new Date().toISOString(),
              user_agent: navigator.userAgent,
              security_event: true
            },
            p_channel: 'audit'
          });
        } catch (error) {
          console.error('Failed to log admin access denied:', error);
        }
      }
    };

    logAccessDenied();
  }, [user]);

  const handleGoHome = () => {
    navigate('/');
  };

  const handleContactSupport = () => {
    window.open('mailto:support@company.com?subject=Admin Access Request', '_blank');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <Card className="border-destructive/20">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-xl font-semibold">Access Denied</CardTitle>
              <CardDescription>
                Superadmin privileges required. Access denied by database authorization.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="destructive">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>403 Forbidden:</strong> Superadmin privileges required. Access denied by database authorization. This attempt has been logged for security purposes.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">User:</span>
                <Badge variant="outline">{user?.email}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Access Level:</span>
                <Badge variant="secondary">Standard User</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Required Level:</span>
                <Badge variant="destructive">Superadmin</Badge>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleGoHome} 
                className="w-full"
                variant="default"
              >
                <Home className="h-4 w-4 mr-2" />
                Return to Dashboard
              </Button>
              
              <Button 
                onClick={handleContactSupport} 
                className="w-full"
                variant="outline"
              >
                <Mail className="h-4 w-4 mr-2" />
                Request Admin Access
              </Button>
            </div>

            <div className="text-xs text-muted-foreground text-center space-y-1">
              <p>If you believe this is an error, please contact your system administrator.</p>
              <p>Security incident logged: {new Date().toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Unauthorized access attempts are monitored and logged.
          </p>
        </div>
      </div>
    </div>
  );
}