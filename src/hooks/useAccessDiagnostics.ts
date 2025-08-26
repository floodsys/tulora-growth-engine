import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AccessDiagnostics {
  role: string | null;
  seat_active: boolean | null;
  is_owner: boolean;
  check_admin_access: boolean;
  user_id: string | null;
  organization_id: string;
}

export interface AccessDiagnosticsResult {
  diagnostics: AccessDiagnostics | null;
  loading: boolean;
  error: string | null;
  fetchDiagnostics: (orgId: string) => Promise<void>;
}

export function useAccessDiagnostics(): AccessDiagnosticsResult {
  const [diagnostics, setDiagnostics] = useState<AccessDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = async (orgId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: user } = await supabase.auth.getUser();
      
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      // Fetch organization membership info
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('role, seat_active')
        .eq('organization_id', orgId)
        .eq('user_id', user.user.id)
        .maybeSingle();

      // Check if user is organization owner
      const { data: orgData } = await supabase
        .from('organizations')
        .select('owner_user_id')
        .eq('id', orgId)
        .single();

      const is_owner = orgData?.owner_user_id === user.user.id;

      // Check admin access via RPC
      const { data: adminAccess } = await supabase
        .rpc('check_admin_access', { 
          p_org_id: orgId,
          p_user_id: user.user.id 
        });

      const diagnosticsResult: AccessDiagnostics = {
        role: memberData?.role || null,
        seat_active: memberData?.seat_active ?? null,
        is_owner,
        check_admin_access: adminAccess || false,
        user_id: user.user.id,
        organization_id: orgId
      };

      setDiagnostics(diagnosticsResult);
    } catch (err: any) {
      console.error('Error fetching access diagnostics:', err);
      setError(err.message || 'Failed to fetch access diagnostics');
    } finally {
      setLoading(false);
    }
  };

  return {
    diagnostics,
    loading,
    error,
    fetchDiagnostics
  };
}