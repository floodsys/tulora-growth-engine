import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle, XCircle, Clock, Users } from "lucide-react";

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

export function InviteAcceptPage() {
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
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    fetchInviteDetails();
  }, [token]);

  const fetchInviteDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('organization_invitations')
        .select(`
          *,
          organizations (name)
        `)
        .eq('invite_token', token)
        .single();

      if (error) throw error;

      if (!data) {
        setError('Invitation not found');
        return;
      }

      if (data.status !== 'pending') {
        setError('This invitation has already been used or is no longer valid');
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError('This invitation has expired');
        return;
      }

      if (user && data.email !== user.email) {
        setError('This invitation is for a different email address');
        return;
      }

      setInvite(data);
    } catch (error) {
      console.error('Error fetching invite:', error);
      setError('Failed to load invitation details');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!token || !user) return;

    setAccepting(true);
    try {
      // For now, use direct database update since RPC may not be available
      const { error } = await supabase
        .from('organization_invitations')
        .update({ status: 'accepted' })
        .eq('invite_token', token);

      if (error) throw error;

      toast({
        title: "Invitation accepted",
        description: `You have successfully joined ${invite?.organizations?.name}`,
      });

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Error accepting invite:', error);
      toast({
        title: "Error",
        description: "Failed to accept invitation",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  const formatRole = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Clock className="h-8 w-8 mx-auto mb-4 text-muted-foreground animate-spin" />
              <p>Loading invitation details...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/')} 
              className="w-full"
              variant="outline"
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
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-primary" />
            <CardTitle>Team Invitation</CardTitle>
            <CardDescription>
              Please sign in to accept this invitation to join {invite?.organizations?.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>
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
              <Badge variant="secondary">{formatRole(invite?.role || '')}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Expires:</span>
              <span className="text-sm">
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
              {accepting ? 'Accepting...' : 'Accept Invitation'}
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