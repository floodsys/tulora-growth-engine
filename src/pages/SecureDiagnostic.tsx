import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import AdminDiagnostic from '@/pages/AdminDiagnostic';

interface DiagnosticGuardProps {
  children: React.ReactNode;
}

function DiagnosticGuard({ children }: DiagnosticGuardProps) {
  const { hasAccess, isChecking, AccessDeniedComponent } = useAdminAccess();
  const navigate = useNavigate();

  useEffect(() => {
    // In production, redirect non-superadmins away from diagnostic page
    if (!hasAccess && !isChecking && import.meta.env.PROD) {
      navigate('/admin');
      return;
    }
  }, [hasAccess, isChecking, navigate]);

  // Show loading while checking access
  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Verifying diagnostic access...</p>
        </div>
      </div>
    );
  }

  // Block access for non-superadmins
  if (!hasAccess) {
    return <AccessDeniedComponent />;
  }

  return <>{children}</>;
}

export default function SecureDiagnosticPage() {
  return (
    <DiagnosticGuard>
      <AdminDiagnostic />
    </DiagnosticGuard>
  );
}