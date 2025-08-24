import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Flag, 
  AlertTriangle,
  Shield,
  Code,
  Database,
  Mail,
  BarChart3,
  Bug
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'debug' | 'feature' | 'performance' | 'security';
  dangerous: boolean;
  environment_restriction?: 'dev' | 'staging' | 'all';
  icon: any;
}

export function FeatureFlags() {
  const { organization, isOwner } = useUserOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Mock feature flags - in real implementation, these would be stored in database or environment
  const [flags, setFlags] = useState<FeatureFlag[]>([
    {
      key: 'debug_sql_logging',
      name: 'SQL Query Logging',
      description: 'Log all database queries to console for debugging',
      enabled: false,
      category: 'debug',
      dangerous: false,
      environment_restriction: 'dev',
      icon: Database
    },
    {
      key: 'debug_email_preview',
      name: 'Email Preview Mode',
      description: 'Preview emails in browser instead of sending them',
      enabled: false,
      category: 'debug',
      dangerous: false,
      environment_restriction: 'all',
      icon: Mail
    },
    {
      key: 'feature_advanced_analytics',
      name: 'Advanced Analytics',
      description: 'Enable experimental analytics features',
      enabled: true,
      category: 'feature',
      dangerous: false,
      environment_restriction: 'all',
      icon: BarChart3
    },
    {
      key: 'debug_api_tracing',
      name: 'API Call Tracing',
      description: 'Detailed tracing of all API calls and responses',
      enabled: false,
      category: 'debug',
      dangerous: false,
      environment_restriction: 'dev',
      icon: Code
    },
    {
      key: 'security_strict_cors',
      name: 'Strict CORS Mode',
      description: 'Enable stricter CORS checking (may break some integrations)',
      enabled: false,
      category: 'security',
      dangerous: true,
      environment_restriction: 'all',
      icon: Shield
    },
    {
      key: 'debug_performance_metrics',
      name: 'Performance Metrics',
      description: 'Collect detailed performance metrics for all operations',
      enabled: false,
      category: 'performance',
      dangerous: false,
      environment_restriction: 'all',
      icon: BarChart3
    },
    {
      key: 'debug_error_simulation',
      name: 'Error Simulation',
      description: 'Randomly simulate errors for testing error handling',
      enabled: false,
      category: 'debug',
      dangerous: true,
      environment_restriction: 'dev',
      icon: Bug
    }
  ]);

  const isDevelopment = process.env.NODE_ENV === 'development';
  const hasAccess = isOwner;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'debug': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'feature': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'performance': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'security': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const isEnvironmentAllowed = (flag: FeatureFlag) => {
    if (!flag.environment_restriction || flag.environment_restriction === 'all') return true;
    if (flag.environment_restriction === 'dev') return isDevelopment;
    if (flag.environment_restriction === 'staging') return !isDevelopment; // Simplified check
    return false;
  };

  const toggleFlag = async (flagKey: string) => {
    if (!hasAccess) return;

    setLoading(true);
    try {
      const flag = flags.find(f => f.key === flagKey);
      if (!flag) return;

      const newValue = !flag.enabled;
      
      // Update local state
      setFlags(flags.map(f => 
        f.key === flagKey ? { ...f, enabled: newValue } : f
      ));

      // In real implementation, this would update the flag in a secure way
      // For now, we'll just log the action
      await supabase.rpc('insert_audit_log', {
        p_org_id: organization?.id,
        p_action: 'admin.feature_flag_toggled',
        p_target_type: 'feature_flag',
        p_target_id: flagKey,
        p_actor_user_id: organization?.owner_user_id,
        p_actor_role_snapshot: 'admin',
        p_status: 'success',
        p_channel: 'internal',
        p_metadata: {
          flag_name: flag.name,
          old_value: flag.enabled,
          new_value: newValue,
          dangerous: flag.dangerous,
          category: flag.category,
          admin_tool: 'feature_flags'
        }
      });

      toast({
        title: 'Feature Flag Updated',
        description: `${flag.name} has been ${newValue ? 'enabled' : 'disabled'}`,
      });

    } catch (err) {
      console.error('Error toggling feature flag:', err);
      toast({
        title: 'Error',
        description: 'Failed to update feature flag',
        variant: 'destructive'
      });
      
      // Revert local state on error
      setFlags(flags.map(f => 
        f.key === flagKey ? { ...f, enabled: !f.enabled } : f
      ));
    } finally {
      setLoading(false);
    }
  };

  const resetAllFlags = async () => {
    if (!hasAccess) return;

    setLoading(true);
    try {
      // Reset all flags to disabled
      setFlags(flags.map(f => ({ ...f, enabled: false })));

      await supabase.rpc('insert_audit_log', {
        p_org_id: organization?.id,
        p_action: 'admin.feature_flags_reset',
        p_target_type: 'system',
        p_actor_user_id: organization?.owner_user_id,
        p_actor_role_snapshot: 'admin',
        p_status: 'success',
        p_channel: 'internal',
        p_metadata: {
          flags_reset: flags.length,
          admin_tool: 'feature_flags'
        }
      });

      toast({
        title: 'Feature Flags Reset',
        description: 'All feature flags have been disabled',
      });

    } catch (err) {
      console.error('Error resetting feature flags:', err);
      toast({
        title: 'Error',
        description: 'Failed to reset feature flags',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!hasAccess) {
    return (
      <Alert variant="destructive">
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Access denied. Only organization owners can access feature flags.
        </AlertDescription>
      </Alert>
    );
  }

  const categorizedFlags = flags.reduce((acc, flag) => {
    if (!acc[flag.category]) acc[flag.category] = [];
    acc[flag.category].push(flag);
    return acc;
  }, {} as Record<string, FeatureFlag[]>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Internal Feature Flags
          </CardTitle>
          <CardDescription>
            Toggle internal debug and feature flags. These are never visible to customers.
            Changes are logged in the audit trail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-6">
            <div className="text-sm text-muted-foreground">
              Environment: {isDevelopment ? 'Development' : 'Production'}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetAllFlags}
              disabled={loading}
            >
              Reset All Flags
            </Button>
          </div>

          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Feature flags marked as "dangerous" can affect system behavior. 
              Use with caution and monitor system performance after enabling.
            </AlertDescription>
          </Alert>

          <div className="space-y-6">
            {Object.entries(categorizedFlags).map(([category, categoryFlags]) => (
              <div key={category} className="space-y-4">
                <h3 className="text-lg font-medium capitalize">{category} Flags</h3>
                <div className="space-y-3">
                  {categoryFlags.map((flag) => {
                    const IconComponent = flag.icon;
                    const isDisabledByEnv = !isEnvironmentAllowed(flag);
                    
                    return (
                      <div 
                        key={flag.key}
                        className={`flex items-center justify-between p-4 border rounded-lg ${
                          isDisabledByEnv ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <IconComponent className="h-5 w-5" />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{flag.name}</span>
                              <Badge className={getCategoryColor(flag.category)}>
                                {flag.category}
                              </Badge>
                              {flag.dangerous && (
                                <Badge variant="destructive" className="text-xs">
                                  Dangerous
                                </Badge>
                              )}
                              {flag.environment_restriction && flag.environment_restriction !== 'all' && (
                                <Badge variant="outline" className="text-xs">
                                  {flag.environment_restriction} only
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {flag.description}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={flag.enabled}
                          onCheckedChange={() => toggleFlag(flag.key)}
                          disabled={loading || isDisabledByEnv}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}