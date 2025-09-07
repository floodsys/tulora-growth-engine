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
              Create Stripe Products & Prices
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Set up products and prices for your AI Lead Generation and AI Phone Support plans:
            </p>
            <div className="space-y-3">
              <div className="bg-muted rounded-lg p-3 space-y-2">
                <div className="font-medium text-sm">AI Lead Generation Plans</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>• Lead Gen Starter: Monthly subscription + Setup fee</div>
                  <div>• Lead Gen Business: Monthly subscription + Setup fee</div>
                  <div>• Lead Gen Enterprise: Contact sales (no price IDs needed)</div>
                </div>
              </div>
              <div className="bg-muted rounded-lg p-3 space-y-2">
                <div className="font-medium text-sm">AI Phone Support Plans</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>• Support Starter: Monthly subscription + Setup fee</div>
                  <div>• Support Business: Monthly subscription + Setup fee</div>
                  <div>• Support Enterprise: Contact sales (no price IDs needed)</div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2 mt-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('https://dashboard.stripe.com/products', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Create Products
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('https://dashboard.stripe.com/prices', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Create Prices
              </Button>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2 flex items-center">
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-2">2</span>
              Configure Price IDs
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              For each paid plan, you need two price IDs:
            </p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <strong>Monthly Price ID:</strong>
                <span className="text-muted-foreground">Recurring subscription (price_...)</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <strong>Setup Price ID:</strong>
                <span className="text-muted-foreground">One-time setup fee (price_...)</span>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded p-3 mt-3">
              <div className="text-sm font-medium mb-1">💡 Pro Tip</div>
              <div className="text-xs text-muted-foreground">
                Enterprise plans don't need price IDs - they're configured as "Contact Sales" automatically.
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2 flex items-center">
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-2">3</span>
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
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-2">4</span>
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
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-2">5</span>
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