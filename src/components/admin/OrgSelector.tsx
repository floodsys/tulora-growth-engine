import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OrgSelectorProps {
  onOrgSelect: (orgId: string) => void;
  selectedOrgId?: string;
}

export function OrgSelector({ onOrgSelect, selectedOrgId }: OrgSelectorProps) {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, plan_key, billing_status')
        .order('name')
        .limit(20);

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyOrgId = (orgId: string) => {
    navigator.clipboard.writeText(orgId);
    toast({
      title: "Copied to clipboard",
      description: "Organization ID copied",
    });
  };

  if (loading) {
    return <div>Loading organizations...</div>;
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Select Organization for Testing</label>
      <div className="flex gap-2">
        <Select value={selectedOrgId} onValueChange={onOrgSelect}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select an organization..." />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name} ({org.plan_key}) - {org.billing_status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedOrgId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyOrgId(selectedOrgId)}
          >
            <Copy className="h-4 w-4" />
          </Button>
        )}
      </div>
      {selectedOrgId && (
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          <strong>Selected:</strong> {selectedOrgId}
        </div>
      )}
    </div>
  );
}