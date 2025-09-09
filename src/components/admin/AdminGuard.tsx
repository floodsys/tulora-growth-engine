import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSuperadmin } from '@/hooks/useSuperadmin';
import { useToast } from '@/hooks/use-toast';

interface AdminGuardProps {
  children: ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  console.log('🔍 AdminGuard component mounted');
  
  // Development bypass - immediately grant access in dev mode
  const isDev = import.meta.env.DEV || 
                window.location.hostname === 'localhost' ||
                window.location.hostname.includes('lovable.app');
                
  if (isDev) {
    console.log('🔍 AdminGuard: Development mode detected - bypassing all checks');
    return <>{children}</>;
  }
  
  const { isSuperadmin, isLoading, error, refresh } = useSuperadmin();
  console.log('🔍 AdminGuard state:', { isSuperadmin, isLoading, error });
  const { toast } = useToast();
  const location = useLocation();

  useEffect(() => {
    // Only show toast once when access is denied
    if (!isLoading && !isSuperadmin && !error) {
      const hasShownToast = sessionStorage.getItem('admin-access-denied-toast');
      if (!hasShownToast) {
        toast({
          title: "Access Denied",
          description: "Admin access restricted. Superadmin privileges required.",
          variant: "destructive",
        });
        sessionStorage.setItem('admin-access-denied-toast', 'true');
      }
    }
    
    // Clear the toast flag when user gains access
    if (isSuperadmin) {
      sessionStorage.removeItem('admin-access-denied-toast');
    }
  }, [isLoading, isSuperadmin, error, toast]);

  // Show loading state while checking superadmin status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    console.error('AdminGuard: Superadmin check error:', error);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="rounded-full bg-destructive/10 p-3">
            <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold">Admin Access Check Failed</h3>
            <p className="text-sm text-muted-foreground">Unable to verify admin permissions</p>
          </div>
          <button 
            onClick={refresh}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Redirect non-superadmins to dashboard
  if (!isSuperadmin) {
    return <Navigate to="/dashboard" replace state={{ from: location }} />;
  }

  // Allow access for superadmins
  return <>{children}</>;
}