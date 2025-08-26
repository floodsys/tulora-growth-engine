import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UserCheck, UserX, RefreshCw } from 'lucide-react';

interface SeatStatus {
  found: boolean;
  role?: string;
  seat_active?: boolean;
  organization_id?: string;
  organization_name?: string;
}

export function SeatStatusCard() {
  const { toast } = useToast();
  const [seatStatus, setSeatStatus] = useState<SeatStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const checkSeatStatus = async () => {
    try {
      setRefreshing(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setSeatStatus({ found: false });
        return;
      }

      // Get user's seat status across all organizations
      // Use explicit foreign key relationship to avoid ambiguity
      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select(`
          role,
          seat_active,
          organization_id,
          organizations!organization_members_organization_id_fkey(name)
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching seat status:', error);
        toast({
          title: "Error checking seat status",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (!memberships || memberships.length === 0) {
        setSeatStatus({ found: false });
      } else {
        // Show the first/primary membership
        const membership = memberships[0];
        setSeatStatus({
          found: true,
          role: membership.role,
          seat_active: membership.seat_active,
          organization_id: membership.organization_id,
          organization_name: (membership.organizations as any)?.name || 'Unknown'
        });
      }
    } catch (error: any) {
      console.error('Seat status check failed:', error);
      toast({
        title: "Seat status check failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const reactivateSeat = async () => {
    if (!seatStatus?.organization_id) return;
    
    try {
      setRefreshing(true);
      const { error } = await supabase
        .from('organization_members')
        .update({ seat_active: true })
        .eq('organization_id', seatStatus.organization_id)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;

      toast({
        title: "Seat reactivated",
        description: "Your organization seat has been reactivated.",
      });

      // Refresh status
      await checkSeatStatus();
    } catch (error: any) {
      console.error('Seat reactivation failed:', error);
      toast({
        title: "Reactivation failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    checkSeatStatus();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Checking Seat Status...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!seatStatus?.found) {
    return (
      <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
            <UserX className="h-5 w-5" />
            No Organization Membership
          </CardTitle>
          <CardDescription className="text-orange-700 dark:text-orange-300">
            You are not a member of any organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-orange-600 dark:text-orange-400">
            This might explain access issues with organization settings.
          </div>
        </CardContent>
      </Card>
    );
  }

  const isActive = seatStatus.seat_active;
  const isAdmin = seatStatus.role === 'admin';

  return (
    <Card className={`${
      isActive 
        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20' 
        : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
    }`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${
          isActive 
            ? 'text-green-800 dark:text-green-200' 
            : 'text-red-800 dark:text-red-200'
        }`}>
          {isActive ? <UserCheck className="h-5 w-5" /> : <UserX className="h-5 w-5" />}
          Organization Seat Status
        </CardTitle>
        <CardDescription className={
          isActive 
            ? 'text-green-700 dark:text-green-300' 
            : 'text-red-700 dark:text-red-300'
        }>
          {seatStatus.organization_name} • Role: {seatStatus.role}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Seat Active:</strong>
            <div className={`font-mono ${
              isActive 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {isActive ? '✅ true' : '❌ false'}
            </div>
          </div>
          <div>
            <strong>Admin Access:</strong>
            <div className={`font-mono ${
              isAdmin 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-orange-600 dark:text-orange-400'
            }`}>
              {isAdmin ? '✅ admin' : `⚠️ ${seatStatus.role}`}
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground font-mono">
          Org ID: {seatStatus.organization_id}
        </div>

        {!isActive && (
          <div className="space-y-2">
            <div className={`text-sm text-red-700 dark:text-red-300`}>
              <strong>Issue:</strong> Your seat is inactive, blocking admin access to organization settings.
            </div>
            <Button 
              onClick={reactivateSeat}
              disabled={refreshing}
              size="sm"
              variant="outline"
            >
              {refreshing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Reactivating...
                </>
              ) : (
                'Reactivate Seat'
              )}
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={checkSeatStatus}
            disabled={refreshing}
            size="sm"
            variant="ghost"
          >
            {refreshing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Status
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}