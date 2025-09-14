import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, AlertCircle, CheckCircle } from "lucide-react";

interface ChangeEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string;
}

export function ChangeEmailModal({ open, onOpenChange, currentEmail }: ChangeEmailModalProps) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'verification'>('form');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEmail || !password) {
      toast({
        title: "Missing information",
        description: "Please provide both new email and password",
        variant: "destructive",
      });
      return;
    }

    if (newEmail === currentEmail) {
      toast({
        title: "Same email",
        description: "The new email cannot be the same as your current email",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // First verify the password by attempting to update with the same email
      const { error: passwordError } = await supabase.auth.updateUser({
        email: currentEmail,
        password: password
      });

      if (passwordError) {
        throw new Error("Invalid password");
      }

      // Now update to the new email
      const { error } = await supabase.auth.updateUser({
        email: newEmail
      });

      if (error) throw error;

      setStep('verification');
      toast({
        title: "Verification email sent",
        description: `A confirmation email has been sent to ${newEmail}`,
      });
    } catch (error: any) {
      console.error('Error updating email:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewEmail("");
    setPassword("");
    setStep('form');
    onOpenChange(false);
  };

  const handleDone = () => {
    handleClose();
    toast({
      title: "Email change initiated",
      description: "Please check your email and click the confirmation link to complete the change",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Change Email Address
          </DialogTitle>
          <DialogDescription>
            {step === 'form' 
              ? "Enter your new email address and current password to confirm the change"
              : "Check your email to complete the verification process"
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'form' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-email">Current Email</Label>
              <Input
                id="current-email"
                type="email"
                value={currentEmail}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-email">New Email Address *</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="Enter new email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Current Password *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your current password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You will need to verify your new email address before the change takes effect. 
                You will remain logged in during this process.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Sending..." : "Change Email"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                A verification email has been sent to <strong>{newEmail}</strong>. 
                Please check your inbox and click the confirmation link to complete the email change.
              </AlertDescription>
            </Alert>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>What happens next:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Check your email inbox and spam folder</li>
                <li>Click the verification link in the email</li>
                <li>Your email will be updated after verification</li>
                <li>You'll receive a confirmation once the change is complete</li>
              </ul>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                If you don't receive the email within a few minutes, please check your spam folder 
                or try the process again.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button onClick={handleDone} className="w-full">
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}