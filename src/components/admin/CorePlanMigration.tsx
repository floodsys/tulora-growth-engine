import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL, SUPABASE_ANON } from '@/config/publicConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, ArrowRight, CheckCircle } from 'lucide-react';

interface CoreOrganization {
  id: string;
  name: string;
  plan_key: string;
  billing_status: string;
  stripe_customer_id: string | null;
  owner_user_id: string;
}

interface MigrationMapping {
  organization_id: string;
  new_plan_key: string;
  migration_action: 'migrate' | 'contact_sales' | 'trial';
}

export function CorePlanMigration() {
  const [coreOrgs, setCoreOrgs] = useState<CoreOrganization[]>([]);
  const [mappings, setMappings] = useState<Record<string, MigrationMapping>>({});
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const { toast } = useToast();

  const planOptions = [
    { value: 'leadgen_starter', label: 'Lead Generation Starter', category: 'leadgen' },
    { value: 'leadgen_business', label: 'Lead Generation Business', category: 'leadgen' },
    { value: 'leadgen_enterprise', label: 'Lead Generation Enterprise', category: 'leadgen' },
    { value: 'support_starter', label: 'Customer Service Starter', category: 'support' },
    { value: 'support_business', label: 'Customer Service Business', category: 'support' },
    { value: 'support_enterprise', label: 'Customer Service Enterprise', category: 'support' },
    { value: 'contact_sales', label: 'Contact Sales (Manual Setup)', category: 'special' },
    { value: 'trial', label: 'Convert to Trial', category: 'special' }
  ];

  useEffect(() => {
    fetchCoreOrganizations();
  }, []);

  const fetchCoreOrganizations = async () => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-core-migration`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'apikey': SUPABASE_ANON,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setCoreOrgs(data.coreOrganizations || []);
      
      // Initialize mappings with default values
      const initialMappings: Record<string, MigrationMapping> = {};
      data.coreOrganizations?.forEach((org: CoreOrganization) => {
        initialMappings[org.id] = {
          organization_id: org.id,
          new_plan_key: 'leadgen_starter', // Default suggestion
          migration_action: 'migrate'
        };
      });
      setMappings(initialMappings);
    } catch (error) {
      console.error('Error fetching core organizations:', error);
      toast({
        title: "Error",
        description: "Failed to load organizations with Core plans",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateMapping = (orgId: string, field: keyof MigrationMapping, value: string) => {
    setMappings(prev => ({
      ...prev,
      [orgId]: {
        ...prev[orgId],
        [field]: value
      }
    }));
  };

  const executeMigration = async () => {
    setMigrating(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-core-migration`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'apikey': SUPABASE_ANON,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'migrate',
          mappings: Object.values(mappings)
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setMigrationComplete(true);
      toast({
        title: "Migration Complete",
        description: `Successfully migrated ${result.migratedCount} organizations from Core plans`,
      });
    } catch (error) {
      console.error('Error executing migration:', error);
      toast({
        title: "Migration Failed",
        description: "Failed to execute migration. Please try again.",
        variant: "destructive"
      });
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <span>Core Plan Migration</span>
          </CardTitle>
          <CardDescription>Loading organizations with Core plans...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (coreOrgs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span>Core Plan Migration</span>
          </CardTitle>
          <CardDescription>No organizations found using Core plans. Migration not needed.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (migrationComplete) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span>Migration Complete</span>
          </CardTitle>
          <CardDescription>All Core plans have been successfully migrated.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <span>Core Plan Migration Required</span>
        </CardTitle>
        <CardDescription>
          Found {coreOrgs.length} organization{coreOrgs.length !== 1 ? 's' : ''} using deprecated Core plans. 
          Please map each to a new Lead Generation or Support plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {coreOrgs.map((org) => (
          <div key={org.id} className="border rounded-lg p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold">{org.name}</h4>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="outline">{org.plan_key}</Badge>
                  <Badge variant={org.billing_status === 'active' ? 'default' : 'secondary'}>
                    {org.billing_status}
                  </Badge>
                  {org.stripe_customer_id && (
                    <Badge variant="outline" className="text-xs">
                      Stripe Customer
                    </Badge>
                  )}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground mt-1" />
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Migration Action</label>
                <Select
                  value={mappings[org.id]?.migration_action || 'migrate'}
                  onValueChange={(value) => updateMapping(org.id, 'migration_action', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="migrate">Migrate to New Plan</SelectItem>
                    <SelectItem value="contact_sales">Mark as Contact Sales</SelectItem>
                    <SelectItem value="trial">Convert to Trial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {mappings[org.id]?.migration_action === 'migrate' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Plan</label>
                  <Select
                    value={mappings[org.id]?.new_plan_key || 'leadgen_starter'}
                    onValueChange={(value) => updateMapping(org.id, 'new_plan_key', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {planOptions
                        .filter(option => option.category !== 'special')
                        .map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        ))}
        
        <div className="flex justify-end pt-4 border-t">
          <Button 
            onClick={executeMigration} 
            disabled={migrating}
            className="min-w-32"
          >
            {migrating ? "Migrating..." : "Execute Migration"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}