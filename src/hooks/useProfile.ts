import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileData {
  organization_name?: string | null;
  organization_size?: string | null;
  industry?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  current_org_id?: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async (): Promise<ProfileData | null> => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Profile fetch error:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const invalidateProfile = () => {
    queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
  };

  return {
    profile: query.data,
    isLoading: query.isLoading,
    error: query.error,
    invalidateProfile,
  };
}