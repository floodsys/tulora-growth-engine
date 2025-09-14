import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UsageRollup {
  id: string;
  organization_id: string;
  year_month: string;
  minutes: number;
  calls: number;
  messages: number;
  kb_ops: number;
  concurrency_peak: number;
  created_at: string;
  updated_at: string;
}

interface UsageEvent {
  id: string;
  organization_id: string;
  event_type: string;
  resource_type: string;
  resource_id: string;
  quantity: number;
  cost_cents: number;
  metadata: any;
  created_at: string;
}

interface ConcurrencyData {
  current: number;
  limit: number;
  peak_this_month: number;
  percentage: number;
  warning_threshold: number;
  critical_threshold: number;
  status: 'ok' | 'warning' | 'critical';
}

interface UseUsageDataReturn {
  currentUsage: UsageRollup | null;
  usageEvents: UsageEvent[];
  concurrency: ConcurrencyData | null;
  loading: boolean;
  error: string | null;
  refreshUsage: () => Promise<void>;
  refreshConcurrency: () => Promise<void>;
}

export function useUsageData(organizationId: string | null): UseUsageDataReturn {
  const [currentUsage, setCurrentUsage] = useState<UsageRollup | null>(null);
  const [usageEvents, setUsageEvents] = useState<UsageEvent[]>([]);
  const [concurrency, setConcurrency] = useState<ConcurrencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentUsage = async () => {
    if (!organizationId) return;

    try {
      // Get current month rollup
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
      
      const { data, error } = await supabase
        .from('usage_rollups')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('year_month', currentMonth)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is ok
        throw error;
      }

      setCurrentUsage(data || {
        id: '',
        organization_id: organizationId,
        year_month: currentMonth,
        minutes: 0,
        calls: 0,
        messages: 0,
        kb_ops: 0,
        concurrency_peak: 0,
        created_at: '',
        updated_at: ''
      });
    } catch (err) {
      console.error('Error fetching current usage:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const fetchUsageEvents = async () => {
    if (!organizationId) return;

    try {
      // Get last 50 usage events
      const { data, error } = await supabase
        .from('usage_events')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setUsageEvents(data || []);
    } catch (err) {
      console.error('Error fetching usage events:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const fetchConcurrency = async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase.functions.invoke('retell-concurrency-get', {
        body: { orgId: organizationId }
      });

      if (error) throw error;

      setConcurrency(data);
    } catch (err) {
      console.error('Error fetching concurrency:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const refreshUsage = async () => {
    setLoading(true);
    setError(null);
    
    await Promise.all([
      fetchCurrentUsage(),
      fetchUsageEvents()
    ]);
    
    setLoading(false);
  };

  const refreshConcurrency = async () => {
    await fetchConcurrency();
  };

  useEffect(() => {
    if (organizationId) {
      refreshUsage();
      fetchConcurrency();
    }
  }, [organizationId]);

  // Set up real-time subscription for usage events
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel('usage-events-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'usage_events',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          setUsageEvents(prev => [payload.new as UsageEvent, ...prev.slice(0, 49)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  return {
    currentUsage,
    usageEvents,
    concurrency,
    loading,
    error,
    refreshUsage,
    refreshConcurrency
  };
}