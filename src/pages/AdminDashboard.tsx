import { AdminGuard } from '@/components/admin/AdminGuard';
import { TestDashboard } from '@/components/tests/TestDashboard';

export default function AdminDashboard() {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <TestDashboard />
        </div>
      </div>
    </AdminGuard>
  );
}