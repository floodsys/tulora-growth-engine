import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ManageBillingButtonProps {
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export const ManageBillingButton = ({ variant = 'outline', size = 'default', className }: ManageBillingButtonProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleManageBilling = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-portal', {
        body: {
          returnUrl: `${import.meta.env.VITE_APP_URL}/billing`
        }
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      variant={variant} 
      size={size} 
      className={className}
      onClick={handleManageBilling}
      disabled={loading || !user}
    >
      {loading ? 'Loading...' : 'Manage Billing'}
    </Button>
  );
};