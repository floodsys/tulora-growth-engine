import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, Shield, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MFAFactor {
  id: string;
  factor_type: string;
  friendly_name?: string;
  status: string;
}

interface MFAFactorManagerProps {
  onFactorChanged: () => void;
}

export function MFAFactorManager({ onFactorChanged }: MFAFactorManagerProps) {
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadFactors();
  }, []);

  const loadFactors = async () => {
    try {
      const { data: factorData, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setFactors(factorData.totp || []);
    } catch (error: any) {
      toast({
        title: 'Error Loading Factors',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const unenrollFactor = async (factorId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: factorId
      });

      if (error) {
        toast({
          title: 'Unenroll Failed',
          description: `Failed to unenroll factor: ${error.message}`,
          variant: 'destructive'
        });
        return;
      }

      // Log the unenrollment
      await supabase.functions.invoke('auth-logger', {
        body: {
          action: 'mfa_unenrolled',
          userId: (await supabase.auth.getUser()).data.user?.id,
          metadata: {
            factor_id: factorId,
            factor_type: 'totp',
            superadmin: true,
            timestamp: Date.now()
          }
        }
      });

      toast({
        title: 'Factor Removed',
        description: 'TOTP factor has been successfully removed. You can now enroll a new factor.',
      });

      // Refresh factors list
      await loadFactors();
      onFactorChanged();
    } catch (error: any) {
      toast({
        title: 'Unenroll Error',
        description: error.message || 'Failed to unenroll factor',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Shield className="h-5 w-5" />
          <span>MFA Factor Management</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {factors.length > 0 ? (
          <div className="space-y-3">
            {factors.map((factor) => (
              <div key={factor.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div>
                      <div className="font-medium">
                        {factor.friendly_name || factor.factor_type.toUpperCase()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ID: <code className="bg-muted px-1 rounded text-xs">{factor.id}</code>
                      </div>
                    </div>
                    <Badge variant={factor.status === 'verified' ? "default" : "secondary"}>
                      {factor.status}
                    </Badge>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center space-x-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          <span>Remove MFA Factor</span>
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove this TOTP factor? This will:
                          <ul className="list-disc pl-4 mt-2 space-y-1">
                            <li>Disable MFA for this superadmin account</li>
                            <li>Require re-enrollment to access admin features</li>
                            <li>Log this action in the audit trail</li>
                          </ul>
                          <div className="mt-3 p-3 bg-muted rounded">
                            <strong>Factor:</strong> {factor.friendly_name || factor.factor_type}<br/>
                            <strong>ID:</strong> <code className="text-xs">{factor.id}</code>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => unenrollFactor(factor.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove Factor
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div className="text-xs text-muted-foreground">
                  <strong>Type:</strong> {factor.factor_type} • <strong>Status:</strong> {factor.status}
                </div>
              </div>
            ))}

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Recovery Plan:</strong> If you lose access to your authenticator device:
                <ol className="list-decimal pl-4 mt-2 space-y-1">
                  <li>Contact another superadmin to remove your MFA factor</li>
                  <li>Use database direct access (break-glass procedure)</li>
                  <li>Re-enroll with a new device after factor removal</li>
                </ol>
                Always keep backup codes or multiple devices enrolled.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              No MFA factors enrolled. Enroll a TOTP factor to secure your superadmin account.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}