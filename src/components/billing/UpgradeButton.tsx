import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UpgradeButtonProps {
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export const UpgradeButton = ({ variant = 'default', size = 'default', className }: UpgradeButtonProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          priceId: import.meta.env.VITE_PRICE_ID_PRO_MONTHLY,
          successUrl: `${import.meta.env.VITE_APP_URL}/billing?success=true`,
          cancelUrl: `${import.meta.env.VITE_APP_URL}/billing?canceled=true`,
        }
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      variant={variant} 
      size={size} 
      className={className}
      onClick={handleUpgrade}
      disabled={loading || !user}
    >
      {loading ? 'Loading...' : 'Upgrade to Pro'}
    </Button>
  );
};