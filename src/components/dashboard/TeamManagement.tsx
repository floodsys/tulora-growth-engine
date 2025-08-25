import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Clock, Settings, ExternalLink, Shield } from "lucide-react";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface TeamStats {
  totalMembers: number;
  activeSeats: number;
  pendingInvites: number;
}

export function TeamManagement() {
  const [stats, setStats] = useState<TeamStats>({ totalMembers: 0, activeSeats: 0, pendingInvites: 0 });
  const [loading, setLoading] = useState(true);
  const { organization, organizationId, isOwner } = useUserOrganization();
  const { isAdmin, isEditor, isViewer, loading: roleLoading } = useOrganizationRole(organizationId || undefined);
  const navigate = useNavigate();

  // Determine user access level
  const canManageTeam = isOwner || isAdmin;
  const hasTeamAccess = canManageTeam || isEditor || isViewer;

  useEffect(() => {
    if (organizationId && !roleLoading) {
      fetchTeamStats();
    }
  }, [organizationId, roleLoading]);

  const fetchTeamStats = async () => {
    if (!organizationId) return;

    try {
      // Fetch actual team members count
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('seat_active')
        .eq('organization_id', organizationId);

      if (membersError) throw membersError;

      // Fetch pending invites count  
      const { data: invites, error: invitesError } = await supabase
        .from('organization_invitations')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      if (invitesError) throw invitesError;

      const totalMembers = members?.length || 0;
      const activeSeats = members?.filter(m => m.seat_active).length || 0;
      const pendingInvites = invites?.length || 0;

      setStats({ totalMembers, activeSeats, pendingInvites });
    } catch (error) {
      console.error('Error fetching team stats:', error);
      // Fallback to zero stats on error
      setStats({ totalMembers: 0, activeSeats: 0, pendingInvites: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTeamSettings = () => {
    navigate('/settings/teams');
  };

  if (loading || roleLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Team Overview</h1>
          <p className="text-muted-foreground mb-6">Loading team information...</p>
        </div>
      </div>
    );
  }

  // Show access restriction for users without team access
  if (!hasTeamAccess) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Team Overview</h1>
          <p className="text-muted-foreground mb-6">Access restricted</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              Access Restricted
            </CardTitle>
            <CardDescription>
              You need team access permissions to view team information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Contact your organization admin for access to team features.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Team Overview</h1>
        <p className="text-muted-foreground mb-6">
          Quick overview of your team. Manage members, roles, and invitations in settings.
        </p>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Members in {organization?.name || 'your organization'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Active Seats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSeats}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Billable seats in use
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Invites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingInvites}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Invitations awaiting acceptance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Action */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Team Management
          </CardTitle>
          <CardDescription>
            {canManageTeam 
              ? "Manage team members, send invitations, update roles, and control seat access from the full team settings page."
              : "View team information and member details. Contact an admin to manage team settings."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleOpenTeamSettings} size="lg" className="w-full sm:w-auto">
            <ExternalLink className="h-4 w-4 mr-2" />
            {canManageTeam ? 'Open Full Team Settings' : 'View Team Settings'}
          </Button>
          {!canManageTeam && (
            <p className="text-xs text-muted-foreground mt-2">
              Read-only access • Contact admin to manage team
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}