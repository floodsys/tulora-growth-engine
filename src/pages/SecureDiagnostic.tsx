import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SecureDiagnosticPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to main admin dashboard diagnostics tab
    navigate('/admin?tab=diagnostics', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">Redirecting to admin dashboard...</p>
      </div>
    </div>
  );
}