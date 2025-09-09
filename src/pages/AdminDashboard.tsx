import { AdminGuard } from '@/components/admin/AdminGuard';
import { TestDashboard } from '@/components/tests/TestDashboard';
import { AdminSelfCheck } from '@/components/AdminSelfCheck';
import { ProductLineGatingDemo } from '@/components/ProductLineGatingDemo';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const { toast } = useToast();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);

  console.log('AdminDashboard: Component mounted');

  // Get current user's org for testing
  useEffect(() => {
    const getCurrentOrg = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: orgs } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_user_id', user.id)
        .limit(1);

      if (orgs && orgs.length > 0) {
        setCurrentOrgId(orgs[0].id);
      }
    };

    getCurrentOrg();
  }, []);

  const handleSuperadminDebug = async () => {
    try {
      // Get current session to ensure we have valid auth
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to access admin functions",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-superadmin-debug', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      });
      
      if (error) {
        console.error('Debug function error:', error);
        toast({
          title: "Debug Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      console.log('🔐 SUPERADMIN DEBUG RESULT:', data);
      
      if (data.insert_sql) {
        console.log('🚨 MISSING SUPERADMIN ROW - SQL TO RUN:');
        console.log(data.insert_sql);
        toast({
          title: "Missing Superadmin Row",
          description: `SQL to run: ${data.insert_sql}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Superadmin Verified",
          description: "Your superadmin status is confirmed!",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Debug function failed:', error);
      toast({
        title: "Debug Failed",
        description: "Failed to run superadmin debug check",
        variant: "destructive",
      });
    }
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 space-y-6">
            <div className="flex items-center gap-4">
              <Link 
                to="/admin/self-check"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                🔧 Admin Self-Check
              </Link>
              <Link 
                to="/admin/notifications"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                📧 Notifications & CRM
              </Link>
            </div>
            
            <AdminSelfCheck />
            
            <div>
              <button
                onClick={handleSuperadminDebug}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                🔐 Debug Superadmin Status
              </button>
              <p className="text-sm text-muted-foreground mt-2">
                Check console for detailed debug output including environment info and SQL statements
              </p>
            </div>
            
            {/* Product Line Gating Demo */}
            <ProductLineGatingDemo orgId={currentOrgId} />
          </div>
          <TestDashboard />
        </div>
      </div>
    </AdminGuard>
  );
}