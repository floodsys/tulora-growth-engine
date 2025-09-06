import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSuperadmin } from '@/hooks/useSuperadmin';
import { useToast } from '@/hooks/use-toast';

interface AdminGuardProps {
  children: ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { isSuperadmin, isLoading } = useSuperadmin();
  const { toast } = useToast();
  const location = useLocation();

  useEffect(() => {
    // Only show toast if we've finished loading and user is not a superadmin
    if (!isLoading && !isSuperadmin) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access the admin area.",
        variant: "destructive",
      });
    }
  }, [isLoading, isSuperadmin, toast]);

  // Show loading state while checking superadmin status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect non-superadmins to dashboard
  if (!isSuperadmin) {
    return <Navigate to="/dashboard" replace state={{ from: location }} />;
  }

  // TEMPORARY: Bypass MFA for development - TODO: Re-enable for production
  // For production, add MFA/step-up authentication here before rendering children
  return <>{children}</>;
}