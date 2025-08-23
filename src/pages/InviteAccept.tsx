import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle, XCircle, Clock, Users, Mail, AlertTriangle } from "lucide-react";
import { acceptInvite } from "@/lib/invite-helpers";

interface InviteDetails {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  organizations: {
    name: string;
  };
}

function InviteAccept() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link - no token provided');
      setLoading(false);
      return;
    }

    fetchInviteDetails();
  }, [token]);

  const fetchInviteDetails = async () => {
    try {
      // Mock invite details for demonstration
      const mockInvite: InviteDetails = {
        id: "invite1",
        organization_id: "mock-org-id",
        email: user?.email || "user@example.com",
        role: "viewer",
        status: "pending",
        expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        organizations: {
          name: "Acme Corporation"
        }
      };

      // Validate token format
      if (!token || token.length < 10) {
        setError('Invalid invitation token format');
        return;
      }

      // Check if expired (mock check)
      if (new Date(mockInvite.expires_at) < new Date()) {
        setError('This invitation has expired');
        return;
      }

      // Check if already used (mock check)
      if (mockInvite.status !== 'pending') {
        setError('This invitation has already been used or is no longer valid');
        return;
      }

      // Check if user email matches invite email
      if (user && mockInvite.email !== user.email) {
        setError(`This invitation is for ${mockInvite.email}, but you're signed in as ${user.email}`);
        return;
      }

      setInvite(mockInvite);
    } catch (error) {
      console.error('Error fetching invite:', error);
      setError('Failed to load invitation details');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!token || !user || !invite) return;

    setAccepting(true);
    try {
      const result = await acceptInvite(token);

      if (result.success) {
        toast({
          title: "Welcome to the team!",
          description: `You have successfully joined ${invite.organizations.name}`,
        });

        // Redirect to teams settings
        navigate('/settings/teams');
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to accept invitation. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error accepting invite:', error);
      toast({
        title: "Error",
        description: "Failed to accept invitation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  const requestNewInvite = () => {
    navigate('/');
    toast({
      title: "Contact your team admin",
      description: "Please ask your team administrator to send you a new invitation",
    });
  };

  const formatRole = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'editor': return 'secondary';
      case 'viewer': return 'outline';
      case 'user': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Skeleton className="h-12 w-12 rounded-full mx-auto" />
              <Skeleton className="h-6 w-48 mx-auto" />
              <Skeleton className="h-4 w-64 mx-auto" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Invalid Invitation</CardTitle>
            <CardDescription className="text-base">{error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={requestNewInvite} 
              className="w-full"
            >
              <Mail className="h-4 w-4 mr-2" />
              Request New Invite
            </Button>
            <Button 
              onClick={() => navigate('/')} 
              variant="outline" 
              className="w-full"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Team Invitation</CardTitle>
            <CardDescription className="text-base">
              You've been invited to join <strong>{invite?.organizations?.name}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Email:</span>
                <span className="text-sm">{invite?.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Role:</span>
                <Badge variant={getRoleBadgeVariant(invite?.role || '')}>
                  {formatRole(invite?.role || '')}
                </Badge>
              </div>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-amber-800 dark:text-amber-200">Sign in required</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Please sign in with the email address this invitation was sent to
                  </p>
                </div>
              </div>
            </div>
            
            <Button 
              onClick={() => navigate('/auth')} 
              className="w-full"
            >
              Sign In to Accept
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-xl">You're Invited!</CardTitle>
          <CardDescription className="text-base">
            Join <strong>{invite?.organizations?.name}</strong> as a team member
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Your email:</span>
              <span className="text-sm">{invite?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Role:</span>
              <Badge variant={getRoleBadgeVariant(invite?.role || '')}>
                {formatRole(invite?.role || '')}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Expires:</span>
              <span className="text-sm text-muted-foreground">
                {invite?.expires_at ? new Date(invite.expires_at).toLocaleDateString() : 'Unknown'}
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <Button 
              onClick={handleAcceptInvite} 
              className="w-full"
              disabled={accepting}
            >
              {accepting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept Invitation
                </>
              )}
            </Button>
            <Button 
              onClick={() => navigate('/')} 
              variant="outline" 
              className="w-full"
            >
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default InviteAccept;