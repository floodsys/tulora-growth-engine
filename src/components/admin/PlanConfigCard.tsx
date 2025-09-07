import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, ExternalLink, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useState } from 'react';
import { SUPABASE_URL, SUPABASE_ANON } from '@/config/publicConfig';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PlanConfig {
  plan_key: string;
  display_name: string;
  stripe_price_id_monthly: string | null;
  stripe_setup_price_id: string | null;
  product_line?: string;
}

interface ValidationResult {
  productName: string;
  amount: number;
  currency: string;
  recurring: boolean;
  interval?: string;
  isTestMode: boolean;
  livemode: boolean;
}

interface PlanConfigCardProps {
  plan: PlanConfig;
  onUpdate: (planKey: string, field: string, value: string) => void;
  onSave: (plan: PlanConfig) => void;
  saving: boolean;
}

export function PlanConfigCard({ plan, onUpdate, onSave, saving }: PlanConfigCardProps) {
  const [validatingMonthly, setValidatingMonthly] = useState(false);
  const [validatingSetup, setValidatingSetup] = useState(false);
  const [monthlyValidation, setMonthlyValidation] = useState<ValidationResult | null>(null);
  const [setupValidation, setSetupValidation] = useState<ValidationResult | null>(null);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const isEnterprise = plan.plan_key.includes('enterprise');
  const hasMonthlyPrice = !!plan.stripe_price_id_monthly;
  const hasSetupPrice = !!plan.stripe_setup_price_id;
  const isConfigured = hasMonthlyPrice && hasSetupPrice;

  const validatePrice = async (priceId: string, type: 'monthly' | 'setup') => {
    if (!priceId) return;
    
    const setValidating = type === 'monthly' ? setValidatingMonthly : setValidatingSetup;
    const setValidation = type === 'monthly' ? setMonthlyValidation : setSetupValidation;
    const setError = type === 'monthly' ? setMonthlyError : setSetupError;
    
    setValidating(true);
    setError(null);
    
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-stripe-config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'apikey': SUPABASE_ANON,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'validate_price',
          priceId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setValidation(data.validation);
        
        // Check for warnings
        const warnings = [];
        if (data.validation.isTestMode || !data.validation.livemode) {
          warnings.push('Test mode');
        }
        if (type === 'monthly' && !data.validation.recurring) {
          warnings.push('Not recurring');
        }
        if (type === 'setup' && data.validation.recurring) {
          warnings.push('Should be one-time');
        }
        
        if (warnings.length > 0) {
          toast({
            title: "Validation Warnings",
            description: `${type} price: ${warnings.join(', ')}`,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Validation Success",
            description: `${type} price is valid`,
          });
        }
      } else {
        setError(data.error);
        toast({
          title: "Validation Failed",
          description: data.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Validation failed';
      setError(errorMsg);
      toast({
        title: "Validation Error",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setValidating(false);
    }
  };
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{plan.display_name}</CardTitle>
            {plan.product_line && (
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-xs font-mono">
                  {plan.product_line}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {plan.plan_key}
                </Badge>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={isConfigured ? "default" : "secondary"}>
              {isConfigured ? "Configured" : "Not Configured"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-6">
          <div className="space-y-4">
            <Label htmlFor={`monthly-${plan.plan_key}`} className="flex items-center space-x-2">
              <span>Monthly Price ID</span>
              {hasMonthlyPrice && <Badge variant="outline" className="text-xs">Set</Badge>}
              {monthlyValidation && (
                <Badge variant={monthlyValidation.isTestMode ? "destructive" : "default"} className="text-xs">
                  {monthlyValidation.isTestMode ? "Test" : "Live"}
                </Badge>
              )}
            </Label>
            <div className="flex space-x-2">
              <Input
                id={`monthly-${plan.plan_key}`}
                value={plan.stripe_price_id_monthly || ''}
                onChange={(e) => {
                  onUpdate(plan.plan_key, 'stripe_price_id_monthly', e.target.value);
                  setMonthlyValidation(null);
                  setMonthlyError(null);
                }}
                placeholder="price_1234567890abcdef"
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => validatePrice(plan.stripe_price_id_monthly || '', 'monthly')}
                disabled={!plan.stripe_price_id_monthly || validatingMonthly}
              >
                {validatingMonthly ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : monthlyValidation ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : monthlyError ? (
                  <XCircle className="w-4 h-4 text-red-500" />
                ) : (
                  "Validate"
                )}
              </Button>
            </div>
            {monthlyValidation && (
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded p-2 text-xs">
                <p><strong>{monthlyValidation.productName}</strong></p>
                <p>${(monthlyValidation.amount / 100).toFixed(2)} {monthlyValidation.currency.toUpperCase()} 
                  {monthlyValidation.recurring && ` / ${monthlyValidation.interval}`}</p>
              </div>
            )}
            {monthlyError && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-2 text-xs text-red-700 dark:text-red-300">
                {monthlyError}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Recurring monthly subscription price for AI Lead Generation or AI Customer Service
            </p>
          </div>
          
          <div className="space-y-4">
            <Label htmlFor={`setup-${plan.plan_key}`} className="flex items-center space-x-2">
              <span>Setup Fee Price ID</span>
              {hasSetupPrice && <Badge variant="outline" className="text-xs">Set</Badge>}
              {setupValidation && (
                <Badge variant={setupValidation.isTestMode ? "destructive" : "default"} className="text-xs">
                  {setupValidation.isTestMode ? "Test" : "Live"}
                </Badge>
              )}
            </Label>
            <div className="flex space-x-2">
              <Input
                id={`setup-${plan.plan_key}`}
                value={plan.stripe_setup_price_id || ''}
                onChange={(e) => {
                  onUpdate(plan.plan_key, 'stripe_setup_price_id', e.target.value);
                  setSetupValidation(null);
                  setSetupError(null);
                }}
                placeholder="price_1234567890abcdef"
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => validatePrice(plan.stripe_setup_price_id || '', 'setup')}
                disabled={!plan.stripe_setup_price_id || validatingSetup}
              >
                {validatingSetup ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : setupValidation ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : setupError ? (
                  <XCircle className="w-4 h-4 text-red-500" />
                ) : (
                  "Validate"
                )}
              </Button>
            </div>
            {setupValidation && (
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded p-2 text-xs">
                <p><strong>{setupValidation.productName}</strong></p>
                <p>${(setupValidation.amount / 100).toFixed(2)} {setupValidation.currency.toUpperCase()}</p>
              </div>
            )}
            {setupError && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-2 text-xs text-red-700 dark:text-red-300">
                {setupError}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              One-time setup fee for plan activation
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