import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSuperadmin } from '@/hooks/useSuperadmin';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { AdminFooterBadge } from '@/components/ui/AdminFooterBadge';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { isSuperadmin, isLoading, error, refresh } = useSuperadmin();
  const { toast } = useToast();
  const location = useLocation();

  // Development bypass: Skip admin check in development mode
  const isDev = import.meta.env.DEV || 
                window.location.hostname === 'localhost' ||
                window.location.hostname.includes('lovable.app');
  
  
  // Force debug logging to appear
  console.error('[AdminGuard] FORCED DEBUG - THIS SHOULD ALWAYS SHOW:', {
    isDev,
    hostname: window.location.hostname,
    isSuperadmin,
    isLoading,
    error: error,
    env: import.meta.env.DEV
  });
  
  // Add alert for immediate visibility
  if (!isDev) {
    alert(`AdminGuard Debug: isDev=${isDev}, hostname=${window.location.hostname}, isSuperadmin=${isSuperadmin}, isLoading=${isLoading}`);
  }
  
  if (isDev) {
    console.log('[AdminGuard] Development mode - bypassing admin checks');
    return (
      <>
        {children}
        <AdminFooterBadge />
      </>
    );
  }

  useEffect(() => {
    // Only show toast if we've finished loading and user is not a superadmin
    if (!isLoading && !isSuperadmin && !error) {
      toast({
        title: "Admin Access Restricted",
        description: "You don't have permission to access the admin area.",
        variant: "destructive",
      });
    }
  }, [isLoading, isSuperadmin, error, toast]);

  // Show loading state while checking superadmin status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying admin access...</p>
        </div>
        <AdminFooterBadge />
      </div>
    );
  }

  // Show error state with retry option
  if (error) {
    // Log minimal details for superadmin debugging
    if (isSuperadmin) {
      console.error('AdminGuard error (superadmin debug):', { error, timestamp: new Date().toISOString() });
    }
    
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4 text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <div>
            <h2 className="text-lg font-semibold">Admin Access Check Failed</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Unable to verify admin permissions. Please try again.
            </p>
          </div>
          <Button onClick={refresh} variant="outline">
            Retry Access Check
          </Button>
        </div>
        <AdminFooterBadge />
      </div>
    );
  }

  // Redirect non-superadmins to dashboard
  if (!isSuperadmin) {
    return <Navigate to="/dashboard" replace state={{ from: location }} />;
  }

  // Render protected content for superadmins
  return (
    <>
      {children}
      <AdminFooterBadge />
    </>
  );
}