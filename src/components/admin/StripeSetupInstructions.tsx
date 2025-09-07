import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Copy, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SUPABASE_URL } from '@/config/publicConfig';

export function StripeSetupInstructions() {
  const { toast } = useToast();
  const webhookUrl = `${SUPABASE_URL}/functions/v1/org-billing-webhook`;
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>Setup Instructions</span>
          <Badge variant="outline">Required</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2 flex items-center">
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-2">1</span>
              Configure Stripe Webhook
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Add this webhook endpoint to your Stripe dashboard to receive billing events:
            </p>
            <div className="bg-muted rounded-lg p-3 flex items-center justify-between">
              <code className="text-sm font-mono break-all">{webhookUrl}</code>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('https://dashboard.stripe.com/webhooks', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Stripe Webhooks
              </Button>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2 flex items-center">
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-2">2</span>
              Required Webhook Events
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Enable these events in your webhook configuration:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                'checkout.session.completed',
                'invoice.payment_succeeded',
                'invoice.payment_failed',
                'customer.subscription.updated',
                'customer.subscription.deleted'
              ].map((event) => (
                <Badge key={event} variant="outline" className="font-mono text-xs">
                  {event}
                </Badge>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2 flex items-center">
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-2">3</span>
              Configure Secret Keys
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Ensure these secrets are configured in your edge function settings:
            </p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <code className="text-sm">STRIPE_SECRET_KEY</code>
                <Badge variant="outline">Required</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <code className="text-sm">STRIPE_WEBHOOK_SECRET</code>
                <Badge variant="outline">Required</Badge>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => window.open('https://supabase.com/dashboard/project/nkjxbeypbiclvouqfjyc/settings/functions', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Edge Function Secrets
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}