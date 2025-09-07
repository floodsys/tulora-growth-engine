import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSuperadmin } from '@/hooks/useSuperadmin';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { isSuperadmin, isLoading, error, refresh } = useSuperadmin();
  const { toast } = useToast();
  const location = useLocation();

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
      </div>
    );
  }

  // Redirect non-superadmins to dashboard
  if (!isSuperadmin) {
    return <Navigate to="/dashboard" replace state={{ from: location }} />;
  }

  // Render protected content for superadmins
  return <>{children}</>;
}