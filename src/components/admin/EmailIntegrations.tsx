import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Mail, 
  Send, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Settings,
  Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmailProvider {
  name: string;
  status: 'active' | 'inactive' | 'error';
  domains?: string[];
  api_key_configured: boolean;
  webhook_configured: boolean;
}

interface DomainStatus {
  domain: string;
  verified: boolean;
  dns_records: Array<{
    type: string;
    name: string;
    value: string;
    status: 'verified' | 'pending' | 'failed';
  }>;
}

export function EmailIntegrations() {
  const { organization, isOwner } = useUserOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  
  // Mock data - in real implementation, this would come from edge functions
  const [emailProvider] = useState<EmailProvider>({
    name: 'Resend',
    status: 'active',
    domains: ['yourdomain.com', 'app.yourdomain.com'],
    api_key_configured: true,
    webhook_configured: true
  });

  const [domainStatuses] = useState<DomainStatus[]>([
    {
      domain: 'yourdomain.com',
      verified: true,
      dns_records: [
        { type: 'MX', name: 'yourdomain.com', value: 'feedback-smtp.us-east-1.amazonses.com', status: 'verified' },
        { type: 'TXT', name: '_dmarc.yourdomain.com', value: 'v=DMARC1; p=quarantine;', status: 'verified' },
        { type: 'CNAME', name: 'resend._domainkey.yourdomain.com', value: 'resend._domainkey.resend.com', status: 'verified' }
      ]
    },
    {
      domain: 'app.yourdomain.com',
      verified: false,
      dns_records: [
        { type: 'MX', name: 'app.yourdomain.com', value: 'feedback-smtp.us-east-1.amazonses.com', status: 'pending' },
        { type: 'TXT', name: '_dmarc.app.yourdomain.com', value: 'v=DMARC1; p=quarantine;', status: 'pending' }
      ]
    }
  ]);

  const [canaryPercent] = useState(5); // 5% canary routing

  const hasAccess = isOwner;

  const sendTestEmail = async () => {
    if (!hasAccess || !testEmail.trim()) return;

    setSendingTest(true);
    try {
      // This would call an edge function to send test email
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: {
          to: testEmail.trim(),
          template: 'admin_test',
          metadata: {
            sent_by: organization?.owner_user_id,
            organization_id: organization?.id,
            test_type: 'admin_utility'
          }
        }
      });

      if (error) throw error;

      toast({
        title: 'Test Email Sent',
        description: `Successfully sent test email to ${testEmail}`,
      });

      // Log the test
      await supabase.rpc('insert_audit_log', {
        p_org_id: organization?.id,
        p_action: 'admin.test_email_sent',
        p_target_type: 'email',
        p_target_id: testEmail,
        p_actor_user_id: organization?.owner_user_id,
        p_actor_role_snapshot: 'admin',
        p_status: 'success',
        p_channel: 'internal',
        p_metadata: {
          email_provider: emailProvider.name,
          admin_tool: 'email_integrations'
        }
      });

    } catch (err) {
      console.error('Test email error:', err);
      toast({
        title: 'Error',
        description: 'Failed to send test email',
        variant: 'destructive'
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (!hasAccess) {
    return (
      <Alert variant="destructive">
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Access denied. Only organization owners can access email integrations.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Provider Status
          </CardTitle>
          <CardDescription>
            Current email provider configuration and health status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <span className="font-medium">{emailProvider.name}</span>
              </div>
              <Badge variant={emailProvider.status === 'active' ? 'default' : 'destructive'}>
                {emailProvider.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                {emailProvider.api_key_configured ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">API Key</span>
              </div>
              <div className="flex items-center gap-1">
                {emailProvider.webhook_configured ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">Webhooks</span>
              </div>
            </div>
          </div>

          {canaryPercent > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Canary routing is active: {canaryPercent}% of emails are being routed through the new configuration.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Domain Verification Status</CardTitle>
          <CardDescription>
            DNS configuration and verification status for your email domains
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {domainStatuses.map((domain) => (
            <div key={domain.domain} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{domain.domain}</span>
                  <Badge variant={domain.verified ? 'default' : 'secondary'}>
                    {domain.verified ? 'Verified' : 'Pending'}
                  </Badge>
                </div>
                {domain.verified ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                )}
              </div>

              <div className="pl-4 space-y-2">
                {domain.dns_records.map((record, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {record.type}
                      </Badge>
                      <span className="font-mono text-xs">{record.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground max-w-xs truncate">
                        {record.value}
                      </span>
                      {record.status === 'verified' ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : record.status === 'pending' ? (
                        <AlertTriangle className="h-3 w-3 text-orange-600" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {domain !== domainStatuses[domainStatuses.length - 1] && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Send Test Email</CardTitle>
          <CardDescription>
            Send a test email to verify your email configuration is working
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter email address for test"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              type="email"
            />
            <Button
              onClick={sendTestEmail}
              disabled={sendingTest || !testEmail.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              {sendingTest ? 'Sending...' : 'Send Test'}
            </Button>
          </div>
          
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              The test email will include delivery timestamps, provider information, and a unique tracking ID.
              This action will be logged in the audit trail.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}