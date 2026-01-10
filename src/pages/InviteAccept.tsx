import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle, XCircle, Users, Mail, AlertTriangle } from "lucide-react";

interface InviteDetails {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  organization_name: string;
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
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const token = searchParams.get('token');

  useEffect(() => {
    // Require token parameter
    if (!token) {
      setError('Invalid invitation link - missing token parameter');
      setErrorCode('MISSING_TOKEN');
      setLoading(false);
      return;
    }

    fetchInviteDetails();
  }, [token]);

  const fetchInviteDetails = async () => {
    try {
      // Call the edge function to get invite details (GET request with query params)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/org-invitations-accept?token=${encodeURIComponent(token!)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to load invitation');
        setErrorCode(result.error_code || 'UNKNOWN_ERROR');
        return;
      }

      if (result.success && result.invite) {
        setInvite(result.invite);
      } else {
        setError(result.error || 'Failed to load invitation details');
        setErrorCode(result.error_code || 'UNKNOWN_ERROR');
      }
    } catch (err) {
      console.error('Error fetching invite:', err);
      setError('Failed to load invitation details. Please try again.');
      setErrorCode('FETCH_ERROR');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!token || !user || !invite) return;

    setAccepting(true);
    try {
      // Call the edge function to accept the invite
      const { data, error: acceptError } = await supabase.functions.invoke('org-invitations-accept', {
        method: 'POST',
        body: { token },
      });

      if (acceptError) {
        toast({
          title: "Error",
          description: acceptError.message || "Failed to accept invitation. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (data?.success) {
        toast({
          title: "Welcome to the team!",
          description: `You have successfully joined ${data.organization_name || invite.organization_name}`,
        });

        // Redirect to team tab in organization settings
        navigate('/settings/organization/team');
      } else {
        // Handle specific error codes
        const errorMessage = data?.error || "Failed to accept invitation. Please try again.";
        
        if (data?.error_code === 'EMAIL_MISMATCH') {
          setError(errorMessage);
          setErrorCode('EMAIL_MISMATCH');
        } else {
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
      }
    } catch (err) {
      console.error('Error accepting invite:', err);
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

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" | "destructive" => {
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
      <>
        <Helmet>
          <meta name="robots" content="noindex, nofollow" />
          <title>Loading Invitation - Tulora</title>
        </Helmet>
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
      </>
    );
  }

  if (error) {
    return (
      <>
        <Helmet>
          <meta name="robots" content="noindex, nofollow" />
          <title>Invalid Invitation - Tulora</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">
                {errorCode === 'INVITE_EXPIRED' ? 'Invitation Expired' : 
                 errorCode === 'EMAIL_MISMATCH' ? 'Email Mismatch' :
                 errorCode === 'INVITE_ALREADY_USED' ? 'Invitation Already Used' :
                 'Invalid Invitation'}
              </CardTitle>
              <CardDescription className="text-base">{error}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {errorCode === 'EMAIL_MISMATCH' && user && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-amber-800 dark:text-amber-200">Wrong account</h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        You're signed in as <strong>{user.email}</strong>. Sign out and sign in with the correct email address.
                      </p>
                    </div>
                  </div>
                </div>
              )}
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
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Helmet>
          <meta name="robots" content="noindex, nofollow" />
          <title>Team Invitation - Tulora</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Team Invitation</CardTitle>
              <CardDescription className="text-base">
                You've been invited to join <strong>{invite?.organization_name}</strong>
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
                      Please sign in with <strong>{invite?.email}</strong> to accept this invitation
                    </p>
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={() => navigate(`/auth?redirect=${encodeURIComponent(`/invite/accept?token=${token}`)}`)} 
                className="w-full"
              >
                Sign In to Accept
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // Check if signed-in user email matches invite email
  const emailMatches = user.email?.toLowerCase() === invite?.email?.toLowerCase();

  if (!emailMatches && invite) {
    return (
      <>
        <Helmet>
          <meta name="robots" content="noindex, nofollow" />
          <title>Email Mismatch - Tulora</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-xl">Wrong Account</CardTitle>
              <CardDescription className="text-base">
                This invitation is for a different email address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Invitation for:</span>
                  <span className="text-sm font-mono">{invite.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Signed in as:</span>
                  <span className="text-sm font-mono">{user.email}</span>
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Sign out and sign in with <strong>{invite.email}</strong> to accept this invitation.
                </p>
              </div>
              
              <Button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate(`/auth?redirect=${encodeURIComponent(`/invite/accept?token=${token}`)}`);
                }} 
                className="w-full"
              >
                Sign Out & Switch Account
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
      </>
    );
  }

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <title>Accept Team Invitation - Tulora</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-xl">You're Invited!</CardTitle>
            <CardDescription className="text-base">
              Join <strong>{invite?.organization_name}</strong> as a team member
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
    </>
  );
}

export default InviteAccept;
