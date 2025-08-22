import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UpgradeButton } from '@/components/billing/UpgradeButton';
import { ManageBillingButton } from '@/components/billing/ManageBillingButton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Organization {
  id: string;
  name: string;
}

export default function Billing() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  useEffect(() => {
    if (user) {
      fetchBillingData();
    }
  }, [user]);

  const fetchBillingData = async () => {
    try {
      // Get user's organization through memberships
      const { data: membership } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', user?.id)
        .single();

      if (membership) {
        // Get organization details
        const { data: org } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('id', membership.organization_id)
          .single();

        if (org) {
          setOrganization(org as Organization);
        }
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Please log in to view billing information.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {success && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800">Success!</CardTitle>
            <CardDescription className="text-green-600">
              Your subscription has been activated successfully.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {canceled && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800">Checkout Canceled</CardTitle>
            <CardDescription className="text-yellow-600">
              Your checkout was canceled. You can try again anytime.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Billing & Subscription</CardTitle>
          <CardDescription>
            Manage your subscription and billing information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div>
              <h3 className="font-medium">Current Plan</h3>
              <p className="text-sm text-muted-foreground">
                Free Plan
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <UpgradeButton />
              <ManageBillingButton />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}