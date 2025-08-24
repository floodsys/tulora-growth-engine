import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSuperadmin } from '@/hooks/useSuperadmin';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function AdminSetup() {
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { bootstrapSuperadmin } = useSuperadmin();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check if bootstrap is enabled (mock for now - should be environment variable)
  const isBootstrapEnabled = process.env.NODE_ENV === 'development' || 
    window.location.hostname === 'localhost';

  const handleBootstrap = async () => {
    if (!token.trim()) {
      toast({
        title: "Token required",
        description: "Please enter the bootstrap token.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await bootstrapSuperadmin(token);
      
      if (result.success) {
        toast({
          title: "Bootstrap successful",
          description: "You now have superadmin access. Redirecting to admin dashboard...",
        });
        
        // Redirect to admin dashboard after successful bootstrap
        setTimeout(() => {
          navigate('/admin');
        }, 2000);
      } else {
        toast({
          title: "Bootstrap failed",
          description: result.error || "Invalid token or bootstrap is disabled.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Bootstrap failed",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              You must be signed in to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/auth')} 
              className="w-full"
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isBootstrapEnabled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Bootstrap Disabled</CardTitle>
            <CardDescription>
              Superadmin bootstrap is not enabled in this environment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/dashboard')} 
              variant="outline" 
              className="w-full"
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Superadmin Bootstrap</CardTitle>
          <CardDescription>
            Enter the bootstrap token to gain platform administrator access.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This is a one-time setup process. The bootstrap will be automatically 
              disabled after successful completion.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Bootstrap Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="Enter bootstrap token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isLoading) {
                    handleBootstrap();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Button 
                onClick={handleBootstrap}
                disabled={isLoading || !token.trim()}
                className="w-full"
              >
                {isLoading ? "Bootstrapping..." : "Bootstrap Superadmin"}
              </Button>
              
              <Button 
                onClick={() => navigate('/dashboard')} 
                variant="outline" 
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Signed in as:</strong> {user.email}</p>
            <p><strong>Environment:</strong> {process.env.NODE_ENV}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}