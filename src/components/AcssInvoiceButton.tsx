import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, DollarSign } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface AcssInvoiceButtonProps {
  planKey: string;
  planName: string;
  organizationId?: string;
  isEnterprise?: boolean;
}

export function AcssInvoiceButton({ 
  planKey, 
  planName, 
  organizationId,
  isEnterprise = false 
}: AcssInvoiceButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  // Only show for Enterprise plans
  if (!isEnterprise) {
    return null;
  }

  const handleCreateInvoice = async () => {
    if (!organizationId) {
      toast({
        title: "Error",
        description: "Organization ID is required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-acss-invoice', {
        body: {
          planKey,
          organizationId,
          customerName: customerName.trim() || undefined,
          notes: notes.trim() || undefined
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Invoice Created",
          description: `ACSS invoice created and emailed for ${planName} setup fee`,
        });
        setIsOpen(false);
        setCustomerName('');
        setNotes('');
        
        // Optionally open the invoice URL in a new tab
        if (data.invoiceUrl) {
          window.open(data.invoiceUrl, '_blank');
        }
      } else {
        throw new Error(data.error || 'Failed to create invoice');
      }
    } catch (error) {
      console.error('Error creating ACSS invoice:', error);
      toast({
        title: "Error",
        description: "Failed to create invoice. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <FileText className="w-4 h-4 mr-2" />
          Request Invoice (ACSS)
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Request ACSS Invoice
          </DialogTitle>
          <DialogDescription>
            Create a setup fee invoice for {planName} plan payable via ACSS (Pre-Authorized Debits) from your Canadian bank account.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer Name (Optional)</Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name for invoice"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions or notes for this invoice..."
              rows={3}
            />
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">About ACSS Payments</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Pre-Authorized Debits from Canadian bank accounts</li>
              <li>• Secure and regulated payment method in Canada</li>
              <li>• Invoice will be emailed with payment instructions</li>
              <li>• Setup fee will be processed via bank transfer</li>
            </ul>
          </div>
        </div>
        
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateInvoice}
            disabled={loading}
            className="flex-1"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Invoice
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}