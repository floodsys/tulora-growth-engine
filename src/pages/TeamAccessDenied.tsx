import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Home, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserOrganization } from "@/hooks/useUserOrganization";

export default function TeamAccessDenied() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organizationId } = useUserOrganization();

  useEffect(() => {
    // Log the unauthorized access attempt
    const logAccessDenied = async () => {
      if (user && organizationId) {
        try {
          await supabase.rpc('log_event', {
            p_org_id: organizationId,
            p_action: 'admin.access_denied',
            p_target_type: 'admin_resource',
            p_actor_user_id: user.id,
            p_actor_role_snapshot: 'unauthorized',
            p_target_id: '/dashboard',
            p_status: 'error',
            p_channel: 'internal',
            p_metadata: {
              path: '/dashboard',
              security_event: true,
              timestamp: new Date().toISOString()
            },
            p_error_code: 'access_denied'
          });
        } catch (error) {
          console.error('Failed to log access denied event:', error);
        }
      }
    };

    logAccessDenied();
  }, [user, organizationId]);

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handleContactSupport = () => {
    navigate('/talk-to-us');
  };

  return (
    <>
      <Helmet>
        <title>Admin Access Required</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Admin Access Required</CardTitle>
            <CardDescription className="text-base">
              Only Owners and Admins can manage Teams for this organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              You need administrator privileges to access team management features. 
              Contact your organization owner if you believe this is an error.
            </p>
            
            <div className="space-y-2">
              <Button 
                onClick={handleBackToDashboard} 
                className="w-full"
                variant="default"
              >
                <Home className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              
              <Button 
                onClick={handleContactSupport} 
                variant="outline" 
                className="w-full"
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}