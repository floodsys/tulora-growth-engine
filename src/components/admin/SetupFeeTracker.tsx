import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Save, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SetupFeeTrackerProps {
  organizationId: string;
  organizationName: string;
  currentStatus?: string;
  currentNotes?: string;
  onUpdate?: () => void;
}

export function SetupFeeTracker({ 
  organizationId, 
  organizationName, 
  currentStatus = 'pending', 
  currentNotes = '',
  onUpdate 
}: SetupFeeTrackerProps) {
  const [status, setStatus] = useState(currentStatus);
  const [notes, setNotes] = useState(currentNotes);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const statusOptions = [
    { value: 'pending', label: 'Pending', variant: 'secondary' as const },
    { value: 'collected_off_platform', label: 'Collected Off-Platform', variant: 'default' as const },
    { value: 'waived', label: 'Waived', variant: 'outline' as const }
  ];

  const currentStatusOption = statusOptions.find(opt => opt.value === status);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          setup_fee_status: status,
          setup_fee_notes: notes.trim() || null
        })
        .eq('id', organizationId);

      if (error) throw error;

      toast({
        title: 'Setup Fee Updated',
        description: 'Setup fee status has been updated successfully.',
      });

      onUpdate?.();
    } catch (error) {
      console.error('Error updating setup fee:', error);
      toast({
        title: 'Error',
        description: 'Failed to update setup fee status.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = status !== currentStatus || notes !== currentNotes;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>Setup Fee Tracking</span>
        </CardTitle>
        <CardDescription>
          Admin-only tracking for {organizationName} setup fee collection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="setup-status">Current Status</Label>
          <Badge variant={currentStatusOption?.variant || 'secondary'}>
            {currentStatusOption?.label || 'Unknown'}
          </Badge>
        </div>

        <div>
          <Label htmlFor="setup-status">Setup Fee Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="setup-notes">Internal Notes</Label>
          <Textarea
            id="setup-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add internal notes about setup fee collection, payment method, dates, etc."
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Internal use only - not visible to customers
          </p>
        </div>

        {status === 'collected_off_platform' && (
          <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-800 dark:text-green-200">
                Setup fee marked as collected off-platform. Consider adding details in notes.
              </p>
            </div>
          </div>
        )}

        {status === 'waived' && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Setup fee has been waived. Consider adding reason in notes.
              </p>
            </div>
          </div>
        )}

        <Button 
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="w-full"
        >
          {saving && <Save className="h-4 w-4 mr-2 animate-spin" />}
          {saving ? 'Saving...' : 'Update Setup Fee Status'}
        </Button>
      </CardContent>
    </Card>
  );
}