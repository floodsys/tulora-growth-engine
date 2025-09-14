import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  ExternalLink, 
  Key, 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  Calendar,
  MessageSquare,
  Database,
  Webhook
} from "lucide-react";

interface IntegrationsSettingsProps {
  organizationId?: string;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  status: 'connected' | 'disconnected' | 'error';
  enabled: boolean;
  config?: Record<string, any>;
  lastSync?: string;
}

export function IntegrationsSettings({ organizationId }: IntegrationsSettingsProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'slack',
      name: 'Slack',
      description: 'Send notifications and alerts to Slack channels',
      icon: MessageSquare,
      status: 'disconnected',
      enabled: false
    },
    {
      id: 'calendar',
      name: 'Google Calendar',
      description: 'Sync appointments and schedule calls',
      icon: Calendar,
      status: 'disconnected',
      enabled: false
    },
    {
      id: 'crm',
      name: 'CRM Integration',
      description: 'Connect with Salesforce, HubSpot, or other CRMs',
      icon: Database,
      status: 'disconnected',
      enabled: false
    },
    {
      id: 'webhooks',
      name: 'Webhooks',
      description: 'Real-time data streaming to external endpoints',
      icon: Webhook,
      status: 'connected',
      enabled: true,
      config: {
        endpoint: 'https://api.example.com/webhooks',
        events: ['call.started', 'call.ended', 'call.recorded']
      },
      lastSync: '2024-01-16T10:30:00Z'
    }
  ]);

  const [webhookConfig, setWebhookConfig] = useState({
    endpoint: '',
    secret: '',
    events: [] as string[]
  });

  const [apiKeys, setApiKeys] = useState([
    {
      id: '1',
      name: 'Production API Key',
      key: 'sk_live_***************************',
      created: '2024-01-15T10:00:00Z',
      lastUsed: '2024-01-16T09:45:00Z'
    }
  ]);

  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleToggleIntegration = async (integrationId: string, enabled: boolean) => {
    setIntegrations(prev => prev.map(integration =>
      integration.id === integrationId
        ? { ...integration, enabled, status: enabled ? 'connected' : 'disconnected' }
        : integration
    ));

    toast({
      title: enabled ? "Integration enabled" : "Integration disabled",
      description: `${integrations.find(i => i.id === integrationId)?.name} integration has been ${enabled ? 'enabled' : 'disabled'}.`,
    });
  };

  const handleConnectIntegration = async (integrationId: string) => {
    setLoading(true);
    
    try {
      // Simulate connection process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setIntegrations(prev => prev.map(integration =>
        integration.id === integrationId
          ? { ...integration, status: 'connected', enabled: true }
          : integration
      ));

      toast({
        title: "Integration connected",
        description: "Integration has been successfully connected.",
      });
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Failed to connect integration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectIntegration = async (integrationId: string) => {
    setIntegrations(prev => prev.map(integration =>
      integration.id === integrationId
        ? { ...integration, status: 'disconnected', enabled: false }
        : integration
    ));

    toast({
      title: "Integration disconnected",
      description: "Integration has been disconnected.",
    });
  };

  const generateApiKey = async () => {
    const newKey = {
      id: Date.now().toString(),
      name: `API Key ${apiKeys.length + 1}`,
      key: `sk_live_${Math.random().toString(36).substring(2, 35)}`,
      created: new Date().toISOString(),
      lastUsed: null
    };

    setApiKeys(prev => [...prev, newKey]);

    toast({
      title: "API key generated",
      description: "New API key has been generated. Copy it now as it won't be shown again.",
    });
  };

  const revokeApiKey = async (keyId: string) => {
    setApiKeys(prev => prev.filter(key => key.id !== keyId));

    toast({
      title: "API key revoked",
      description: "API key has been revoked and is no longer valid.",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Available Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Available Integrations
          </CardTitle>
          <CardDescription>
            Connect your account with external services to extend functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {integrations.map((integration) => {
            const Icon = integration.icon;
            return (
              <div key={integration.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Icon className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{integration.name}</h4>
                      {getStatusIcon(integration.status)}
                      <Badge className={getStatusColor(integration.status)}>
                        {integration.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                    {integration.lastSync && (
                      <p className="text-xs text-muted-foreground">
                        Last sync: {new Date(integration.lastSync).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {integration.status === 'connected' && (
                    <Switch
                      checked={integration.enabled}
                      onCheckedChange={(enabled) => handleToggleIntegration(integration.id, enabled)}
                    />
                  )}
                  
                  {integration.status === 'connected' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnectIntegration(integration.id)}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleConnectIntegration(integration.id)}
                      disabled={loading}
                    >
                      {loading ? "Connecting..." : "Connect"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Configuration
          </CardTitle>
          <CardDescription>
            Configure webhooks to receive real-time notifications about events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-endpoint">Endpoint URL</Label>
              <Input
                id="webhook-endpoint"
                placeholder="https://your-app.com/webhooks"
                value={webhookConfig.endpoint}
                onChange={(e) => setWebhookConfig(prev => ({ ...prev, endpoint: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-secret">Webhook Secret</Label>
              <Input
                id="webhook-secret"
                type="password"
                placeholder="Your webhook secret"
                value={webhookConfig.secret}
                onChange={(e) => setWebhookConfig(prev => ({ ...prev, secret: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Events to Subscribe</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                'call.started',
                'call.ended',
                'call.recorded',
                'agent.available',
                'agent.unavailable',
                'voicemail.received'
              ].map((event) => (
                <div key={event} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={event}
                    checked={webhookConfig.events.includes(event)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setWebhookConfig(prev => ({
                          ...prev,
                          events: [...prev.events, event]
                        }));
                      } else {
                        setWebhookConfig(prev => ({
                          ...prev,
                          events: prev.events.filter(e => e !== event)
                        }));
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor={event} className="text-sm">{event}</Label>
                </div>
              ))}
            </div>
          </div>

          <Button className="w-full md:w-auto">
            Save Webhook Configuration
          </Button>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </CardTitle>
          <CardDescription>
            Manage API keys for programmatic access to your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {apiKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium">{key.name}</div>
                  <div className="text-sm text-muted-foreground font-mono">{key.key}</div>
                  <div className="text-xs text-muted-foreground">
                    Created: {new Date(key.created).toLocaleDateString()}
                    {key.lastUsed && (
                      <span> • Last used: {new Date(key.lastUsed).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => revokeApiKey(key.id)}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Keep your API keys secure. They provide full access to your account data. 
              Never share them in publicly accessible areas like GitHub.
            </AlertDescription>
          </Alert>

          <Button onClick={generateApiKey} variant="outline">
            <Key className="h-4 w-4 mr-2" />
            Generate New API Key
          </Button>
        </CardContent>
      </Card>

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Integration Health
          </CardTitle>
          <CardDescription>
            Monitor the health and performance of your integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">4</div>
                <div className="text-sm text-muted-foreground">Active Integrations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">99.9%</div>
                <div className="text-sm text-muted-foreground">Uptime (30 days)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">1.2k</div>
                <div className="text-sm text-muted-foreground">Events Delivered</div>
              </div>
            </div>

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                All integrations are operating normally. No issues detected in the last 24 hours.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}