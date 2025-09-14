import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCallStatus } from '@/hooks/useCallStatus';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { Loader2, Phone, AlertTriangle } from 'lucide-react';

export default function CallHandlingSettings() {
  const { toast } = useToast();
  const { organization } = useUserOrganization();
  const { config, isLoading, updateConfig } = useCallStatus(organization?.id);
  const [isSaving, setIsSaving] = useState(false);

  const [localConfig, setLocalConfig] = useState({
    suspended_fallback: config.suspended_fallback || 'polite_end',
    canceled_fallback: config.canceled_fallback || 'polite_end',
    suspended_message: config.suspended_message || "We're unable to take your call right now. Please try again later or leave a message.",
    canceled_message: config.canceled_message || "We're sorry, but this service is no longer available. Thank you for calling."
  });

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateConfig(localConfig);
      
      toast({
        title: "Settings saved",
        description: "Call handling settings have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving call settings:', error);
      toast({
        title: "Error",
        description: "Failed to save call handling settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call Handling
          </CardTitle>
          <CardDescription>
            Configure how inbound calls are handled when your organization status changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Call Handling
        </CardTitle>
        <CardDescription>
          Configure how inbound calls are handled when your organization status changes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Suspended Organization Handling */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <Label className="text-base font-medium">When Organization is Suspended</Label>
          </div>
          
          <div className="space-y-3">
            <div>
              <Label htmlFor="suspended_fallback">Fallback Action</Label>
              <Select 
                value={localConfig.suspended_fallback} 
                onValueChange={(value) => setLocalConfig(prev => ({ 
                  ...prev, 
                  suspended_fallback: value as 'voicemail' | 'polite_end'
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="polite_end">End call politely</SelectItem>
                  <SelectItem value="voicemail">Route to voicemail</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="suspended_message">Message to Caller</Label>
              <Textarea
                id="suspended_message"
                value={localConfig.suspended_message}
                onChange={(e) => setLocalConfig(prev => ({ 
                  ...prev, 
                  suspended_message: e.target.value 
                }))}
                placeholder="Message played to callers when organization is suspended"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Canceled Organization Handling */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <Label className="text-base font-medium">When Organization is Canceled</Label>
          </div>
          
          <div className="space-y-3">
            <div>
              <Label htmlFor="canceled_fallback">Fallback Action</Label>
              <Select 
                value={localConfig.canceled_fallback} 
                onValueChange={(value) => setLocalConfig(prev => ({ 
                  ...prev, 
                  canceled_fallback: value as 'polite_end'
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="polite_end">End call politely</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Canceled organizations can only end calls politely
              </p>
            </div>

            <div>
              <Label htmlFor="canceled_message">Message to Caller</Label>
              <Textarea
                id="canceled_message"
                value={localConfig.canceled_message}
                onChange={(e) => setLocalConfig(prev => ({ 
                  ...prev, 
                  canceled_message: e.target.value 
                }))}
                placeholder="Message played to callers when organization is canceled"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Information Box */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-2">
            <Phone className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How Call Blocking Works</p>
              <ul className="space-y-1 text-xs">
                <li>• <strong>Active:</strong> Calls proceed normally to your agents</li>
                <li>• <strong>Suspended:</strong> Calls are blocked with your custom message</li>
                <li>• <strong>Canceled:</strong> Calls are immediately ended with a polite message</li>
                <li>• All blocked calls are logged for audit purposes</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="min-w-[120px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}