import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building } from 'lucide-react';
import { OrganizationActivityAdmin } from '@/components/admin/OrganizationActivityAdmin';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Organization {
  id: string;
  name: string;
}

export default function AdminOrgLogsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orgId) {
      loadOrganization();
    }
  }, [orgId]);

  const loadOrganization = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', orgId)
        .single();

      if (error) throw error;
      setOrganization(data);
    } catch (err) {
      console.error('Error loading organization:', err);
      navigate('/admin/logs');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Organization Not Found</h2>
          <Button onClick={() => navigate('/admin/logs')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Logs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/admin/logs')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin Logs
            </Button>
            <div className="flex items-center gap-3">
              <Building className="h-6 w-6 text-muted-foreground" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">{organization.name}</h1>
                <p className="text-sm text-muted-foreground">
                  Organization activity logs and audit trail
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        <OrganizationActivityAdmin 
          organizationId={organization.id}
          organizationName={organization.name}
        />
      </div>
    </div>
  );
}