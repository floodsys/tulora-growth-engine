import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, ExternalLink } from 'lucide-react';

interface PlanConfig {
  plan_key: string;
  display_name: string;
  stripe_price_id_monthly: string | null;
  stripe_setup_price_id: string | null;
}

interface PlanConfigCardProps {
  plan: PlanConfig;
  onUpdate: (planKey: string, field: string, value: string) => void;
  onSave: (plan: PlanConfig) => void;
  saving: boolean;
}

export function PlanConfigCard({ plan, onUpdate, onSave, saving }: PlanConfigCardProps) {
  const hasMonthlyPrice = !!plan.stripe_price_id_monthly;
  const hasSetupPrice = !!plan.stripe_setup_price_id;
  const isConfigured = hasMonthlyPrice || hasSetupPrice;
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{plan.display_name}</CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant={isConfigured ? "default" : "secondary"}>
              {isConfigured ? "Configured" : "Not Configured"}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {plan.plan_key}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`monthly-${plan.plan_key}`} className="flex items-center space-x-2">
              <span>Monthly Price ID</span>
              {hasMonthlyPrice && <Badge variant="outline" className="text-xs">Set</Badge>}
            </Label>
            <Input
              id={`monthly-${plan.plan_key}`}
              value={plan.stripe_price_id_monthly || ''}
              onChange={(e) => onUpdate(plan.plan_key, 'stripe_price_id_monthly', e.target.value)}
              placeholder="price_1234567890abcdef"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Recurring monthly subscription price from Stripe
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor={`setup-${plan.plan_key}`} className="flex items-center space-x-2">
              <span>Setup Fee Price ID</span>
              {hasSetupPrice && <Badge variant="outline" className="text-xs">Set</Badge>}
            </Label>
            <Input
              id={`setup-${plan.plan_key}`}
              value={plan.stripe_setup_price_id || ''}
              onChange={(e) => onUpdate(plan.plan_key, 'stripe_setup_price_id', e.target.value)}
              placeholder="price_1234567890abcdef"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              One-time setup fee (optional)
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open('https://dashboard.stripe.com/prices', '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View Stripe Prices
          </Button>
          
          <Button 
            onClick={() => onSave(plan)}
            disabled={saving}
            size="sm"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Save className="w-4 h-4 mr-2" />
            Save Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}