import { AdminGuard } from '@/components/admin/AdminGuard';
import { TestDashboard } from '@/components/tests/TestDashboard';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function AdminDashboard() {
  const { toast } = useToast();

  const handleSuperadminDebug = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-superadmin-debug');
      
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
          <div className="mb-6">
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
          <TestDashboard />
        </div>
      </div>
    </AdminGuard>
  );
}