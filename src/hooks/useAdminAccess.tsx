import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function useAdminAccess() {
  const { organization, isOwner, loading } = useUserOrganization();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [hasAccess, setHasAccess] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (loading) return;

      setIsChecking(true);
      
      try {
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          await logUnauthorizedAccess('admin_dashboard_access', 'admin_panel', null);
          navigate('/auth');
          return;
        }

        // Source of truth = DB (public.superadmins + GUC fallback inside is_superadmin). Env checks are cosmetic only.
        let userHasAccess = isOwner;
        
        // Check if user is superadmin using only DB RPC
        if (!userHasAccess) {
          const { data: isSuperadmin } = await supabase.rpc('is_superadmin');
          userHasAccess = isSuperadmin || false;
        }

        if (!userHasAccess) {
          await logUnauthorizedAccess('admin_dashboard_access', 'admin_panel', user.id, organization?.id);
          toast({
            title: 'Access Denied',
            description: 'You do not have permission to access the admin panel',
            variant: 'destructive'
          });
          navigate('/dashboard');
          return;
        }

        setHasAccess(true);
      } catch (error) {
        console.error('Error checking admin access:', error);
        toast({
          title: 'Error',
          description: 'Failed to verify admin access',
          variant: 'destructive'
        });
        navigate('/dashboard');
      } finally {
        setIsChecking(false);
      }
    };

    checkAccess();
  }, [loading, isOwner, organization, navigate, toast]);

  const logUnauthorizedAccess = async (
    action: string, 
    resource: string, 
    userId: string | null, 
    orgId?: string
  ) => {
    try {
      await supabase.rpc('log_unauthorized_access', {
        p_attempted_action: action,
        p_attempted_resource: resource,
        p_user_id: userId,
        p_org_id: orgId
      });
    } catch (error) {
      console.error('Failed to log unauthorized access:', error);
    }
  };

  const AccessDeniedComponent = () => {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Access denied. Only organization owners and superadmins can access the admin panel.
            This attempt has been logged.
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  const LoadingComponent = () => {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  };

  return {
    hasAccess,
    isChecking,
    AccessDeniedComponent,
    LoadingComponent,
    logUnauthorizedAccess
  };
}