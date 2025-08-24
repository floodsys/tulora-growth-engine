import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CallStatusConfig {
  suspended_fallback?: 'voicemail' | 'polite_end';
  canceled_fallback?: 'polite_end';
  suspended_message?: string;
  canceled_message?: string;
}

interface CallStatusSettings {
  config: CallStatusConfig;
  isLoading: boolean;
  updateConfig: (newConfig: Partial<CallStatusConfig>) => Promise<void>;
}

export function useCallStatus(organizationId?: string): CallStatusSettings {
  const [config, setConfig] = useState<CallStatusConfig>({});
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!organizationId || !user) {
      setIsLoading(false);
      return;
    }

    fetchCallConfig();
  }, [organizationId, user]);

  const fetchCallConfig = async () => {
    try {
      const { data: org, error } = await supabase
        .from('organizations')
        .select('webhook_config')
        .eq('id', organizationId)
        .single();

      if (error) {
        console.error('Error fetching call config:', error);
        return;
      }

      const callConfig = (org.webhook_config as any)?.call_config || {};
      setConfig(callConfig);
    } catch (error) {
      console.error('Error in fetchCallConfig:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfig = async (newConfig: Partial<CallStatusConfig>) => {
    if (!organizationId) return;

    try {
      setIsLoading(true);

      // Get current webhook config
      const { data: org, error: fetchError } = await supabase
        .from('organizations')
        .select('webhook_config')
        .eq('id', organizationId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      const currentWebhookConfig = (org.webhook_config as any) || {};
      const updatedWebhookConfig = {
        ...currentWebhookConfig,
        call_config: {
          ...(currentWebhookConfig.call_config || {}),
          ...newConfig
        }
      };

      const { error: updateError } = await supabase
        .from('organizations')
        .update({ webhook_config: updatedWebhookConfig })
        .eq('id', organizationId);

      if (updateError) {
        throw updateError;
      }

      setConfig(prev => ({ ...prev, ...newConfig }));

      // Log the configuration change
      await supabase.rpc('log_event', {
        p_org_id: organizationId,
        p_action: 'call_config.updated',
        p_target_type: 'organization',
        p_target_id: organizationId,
        p_status: 'success',
        p_metadata: {
          updated_config: newConfig,
          updated_by: user.id
        }
      });

    } catch (error) {
      console.error('Error updating call config:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    config,
    isLoading,
    updateConfig
  };
}