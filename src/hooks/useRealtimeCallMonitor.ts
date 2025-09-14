import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { handleRetellError } from '@/lib/retell-error-mapper';

type RetellCall = Database['public']['Tables']['retell_calls']['Row'];

export const useRealtimeCallMonitor = (organizationId?: string) => {
  const [liveCalls, setLiveCalls] = useState<RetellCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveCalls = async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('retell_calls')
        .select('*')
        .eq('organization_id', organizationId)
        .in('status', ['ringing', 'in_progress'])
        .order('started_at', { ascending: false });

      if (error) {
        handleRetellError(error, 'fetch-live-calls');
        throw error;
      }

      setLiveCalls(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch live calls');
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`live-calls-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'retell_calls',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          console.log('Live call update:', payload);
          
          const callData = payload.new as RetellCall;
          
          // Handle different event types
          switch (payload.eventType) {
            case 'INSERT':
              // New call started
              if (callData && ['ringing', 'in_progress'].includes(callData.status)) {
                setLiveCalls(prev => [callData, ...prev]);
              }
              break;
              
            case 'UPDATE':
              // Call status changed
              if (callData) {
                setLiveCalls(prev => {
                  const updated = prev.map(call => 
                    call.id === callData.id ? callData : call
                  );
                  
                  // Remove calls that are no longer live
                  return updated.filter(call => 
                    ['ringing', 'in_progress'].includes(call.status)
                  );
                });
              }
              break;
              
            case 'DELETE':
              // Call deleted
              setLiveCalls(prev => prev.filter(call => call.id !== payload.old.id));
              break;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  // Initial fetch
  useEffect(() => {
    fetchLiveCalls();
  }, [organizationId]);

  return {
    liveCalls,
    loading,
    error,
    refresh: fetchLiveCalls
  };
};