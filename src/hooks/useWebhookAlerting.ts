import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WebhookAlert {
  id: string;
  event_type: 'failure_spike' | 'success_rate_drop' | 'timeout_increase';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  current_value: number;
  triggered_at: string;
  organization_id: string;
}

export const useWebhookAlerting = (organizationId?: string) => {
  const [alerts, setAlerts] = useState<WebhookAlert[]>([]);
  const [loading, setLoading] = useState(false);

  // Alert thresholds
  const ALERT_THRESHOLDS = {
    failure_spike: {
      low: 5, // 5% failure rate
      medium: 10, // 10% failure rate
      high: 20, // 20% failure rate
      critical: 50 // 50% failure rate
    },
    success_rate_drop: {
      low: 95, // Success rate below 95%
      medium: 90, // Success rate below 90%
      high: 80, // Success rate below 80%
      critical: 70 // Success rate below 70%
    },
    timeout_increase: {
      low: 5000, // 5 second timeouts
      medium: 10000, // 10 second timeouts
      high: 30000, // 30 second timeouts
      critical: 60000 // 60 second timeouts
    }
  };

  const checkWebhookHealth = async () => {
    if (!organizationId) return;

    try {
      setLoading(true);

      // Get webhook events from the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const { data: events, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('target_type', 'webhook')
        .gte('created_at', oneHourAgo.toISOString());

      if (error) throw error;

      const webhookEvents = events || [];
      const totalEvents = webhookEvents.length;
      
      if (totalEvents === 0) return; // No events to analyze

      const failedEvents = webhookEvents.filter(event => event.status === 'failed');
      const successfulEvents = webhookEvents.filter(event => event.status === 'success');
      
      const failureRate = (failedEvents.length / totalEvents) * 100;
      const successRate = (successfulEvents.length / totalEvents) * 100;

      const newAlerts: WebhookAlert[] = [];

      // Check failure spike
      let failureSeverity: keyof typeof ALERT_THRESHOLDS.failure_spike | null = null;
      if (failureRate >= ALERT_THRESHOLDS.failure_spike.critical) {
        failureSeverity = 'critical';
      } else if (failureRate >= ALERT_THRESHOLDS.failure_spike.high) {
        failureSeverity = 'high';
      } else if (failureRate >= ALERT_THRESHOLDS.failure_spike.medium) {
        failureSeverity = 'medium';
      } else if (failureRate >= ALERT_THRESHOLDS.failure_spike.low) {
        failureSeverity = 'low';
      }

      if (failureSeverity) {
        newAlerts.push({
          id: `failure-spike-${Date.now()}`,
          event_type: 'failure_spike',
          severity: failureSeverity,
          message: `Webhook failure rate is ${failureRate.toFixed(1)}% (${failedEvents.length}/${totalEvents} events failed)`,
          threshold: ALERT_THRESHOLDS.failure_spike[failureSeverity],
          current_value: failureRate,
          triggered_at: new Date().toISOString(),
          organization_id: organizationId
        });
      }

      // Check success rate drop
      let successSeverity: keyof typeof ALERT_THRESHOLDS.success_rate_drop | null = null;
      if (successRate <= ALERT_THRESHOLDS.success_rate_drop.critical) {
        successSeverity = 'critical';
      } else if (successRate <= ALERT_THRESHOLDS.success_rate_drop.high) {
        successSeverity = 'high';
      } else if (successRate <= ALERT_THRESHOLDS.success_rate_drop.medium) {
        successSeverity = 'medium';
      } else if (successRate <= ALERT_THRESHOLDS.success_rate_drop.low) {
        successSeverity = 'low';
      }

      if (successSeverity) {
        newAlerts.push({
          id: `success-drop-${Date.now()}`,
          event_type: 'success_rate_drop',
          severity: successSeverity,
          message: `Webhook success rate dropped to ${successRate.toFixed(1)}% (expected >95%)`,
          threshold: ALERT_THRESHOLDS.success_rate_drop[successSeverity],
          current_value: successRate,
          triggered_at: new Date().toISOString(),
          organization_id: organizationId
        });
      }

      // Show toast notifications for new alerts
      newAlerts.forEach(alert => {
        const toastOptions = {
          duration: alert.severity === 'critical' ? 0 : 10000, // Critical alerts don't auto-dismiss
        };

        switch (alert.severity) {
          case 'critical':
            toast.error(`🚨 CRITICAL: ${alert.message}`, toastOptions);
            break;
          case 'high':
            toast.error(`⚠️ HIGH: ${alert.message}`, toastOptions);
            break;
          case 'medium':
            toast.warning(`⚠️ MEDIUM: ${alert.message}`, toastOptions);
            break;
          case 'low':
            toast.info(`ℹ️ LOW: ${alert.message}`, toastOptions);
            break;
        }
      });

      setAlerts(prev => {
        // Keep only recent alerts (last 24 hours) and add new ones
        const recentAlerts = prev.filter(alert => {
          const alertTime = new Date(alert.triggered_at);
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return alertTime > dayAgo;
        });
        
        return [...recentAlerts, ...newAlerts];
      });

    } catch (error) {
      console.error('Error checking webhook health:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-check every 5 minutes
  useEffect(() => {
    const interval = setInterval(checkWebhookHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [organizationId]);

  // Initial check
  useEffect(() => {
    if (organizationId) {
      checkWebhookHealth();
    }
  }, [organizationId]);

  const clearAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  return {
    alerts,
    loading,
    checkWebhookHealth,
    clearAlert,
    clearAllAlerts
  };
};
