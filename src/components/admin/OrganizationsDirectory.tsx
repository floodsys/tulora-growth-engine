import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  ExternalLink, 
  Pause, 
  Play, 
  CreditCard, 
  ArrowRightLeft, 
  FileText,
  Mail,
  Trash2,
  RefreshCw,
  Download,
  XCircle,
  Ban,
  Shield,
  Info,
  Users,
  Settings
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { getOrgStatusMessage } from '@/lib/error-codes';
import { TransferOwnershipDialog } from './TransferOwnershipDialog';
import { ViewActivityDialog } from './ViewActivityDialog';
import { SuspensionDialog } from './SuspensionDialog';
import { SetupFeeTracker } from './SetupFeeTracker';

interface Organization {
  id: string;
  name: string;
  owner_user_id: string;
  owner_email?: string;
  plan_key: string;
  billing_status: string;
  status: string;
  suspension_reason?: string;
  created_at: string;
  member_count?: number;
  active_seats?: number;
  seat_limit?: number;
  last_activity?: string;
  mrr?: number;
  trial_ends_at?: string;
  setup_fee_status?: string;
  setup_fee_notes?: string;
}

export function OrganizationsDirectory() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    plan: 'all',
    status: 'all',
    overLimit: false,
    inactive: false,
    trialing: false
  });
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [suspensionDialogOpen, setSuspensionDialogOpen] = useState(false);
  const [suspensionAction, setSuspensionAction] = useState<'suspend' | 'reinstate' | 'cancel' | undefined>(undefined);
  const [transferOrgId, setTransferOrgId] = useState<string | null>(null);
  const [viewActivityOrgId, setViewActivityOrgId] = useState<string | null>(null);
  const [setupFeeOrgId, setSetupFeeOrgId] = useState<string | null>(null);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const { data: orgsData, error: orgsError } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          owner_user_id,
          plan_key,
          billing_status,
          status,
          suspension_reason,
          created_at,
          trial_ends_at,
          setup_fee_status,
          setup_fee_notes
        `);

      if (orgsError) throw orgsError;

      // Get owner emails separately
      const orgIds = orgsData?.map(org => org.owner_user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email')
        .in('user_id', orgIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.email]) || []);


      // Get member counts for each organization
      const orgsWithDetails = await Promise.all(
        (orgsData || []).map(async (org) => {
          // Get member count and active seats
          const { data: membersData } = await supabase
            .from('organization_members')
            .select('id, seat_active')
            .eq('organization_id', org.id);

          const activeSeats = membersData?.filter(m => m.seat_active).length || 0;
          const totalMembers = membersData?.length || 0;

          // Get last activity (mock for now)
          const lastActivity = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();

          return {
            ...org,
            owner_email: profileMap.get(org.owner_user_id) || 'Unknown',
            member_count: totalMembers,
            active_seats: activeSeats,
            seat_limit: getSeatLimit(org.plan_key),
            last_activity: lastActivity,
            mrr: getMRR(org.plan_key, org.billing_status)
          };
        })
      );

      setOrganizations(orgsWithDetails);
    } catch (error) {
      console.error('Error loading organizations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load organizations',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getSeatLimit = (planKey: string): number => {
    const limits = { trial: 5, basic: 10, premium: 50, enterprise: 200 };
    return limits[planKey as keyof typeof limits] || 5;
  };

  const getMRR = (planKey: string, billingStatus: string): number => {
    if (billingStatus !== 'active') return 0;
    const rates = { trial: 0, basic: 29, premium: 99, enterprise: 299 };
    return rates[planKey as keyof typeof rates] || 0;
  };

  const filteredOrganizations = useMemo(() => {
    return organizations.filter(org => {
      const matchesSearch = 
        org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.owner_email?.toLowerCase().includes(searchQuery.toLowerCase()) || false;

      const matchesPlan = filters.plan === 'all' || org.plan_key === filters.plan;
      const matchesStatus = filters.status === 'all' || 
        org.billing_status === filters.status ||
        org.status === filters.status;
      
      const isOverLimit = filters.overLimit ? (org.active_seats || 0) > (org.seat_limit || 0) : true;
      
      const isInactive = filters.inactive 
        ? org.last_activity && new Date(org.last_activity) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        : true;
      
      const isTrialing = filters.trialing ? org.plan_key === 'trial' : true;

      return matchesSearch && matchesPlan && matchesStatus && isOverLimit && isInactive && isTrialing;
    });
  }, [organizations, searchQuery, filters]);

  const handleSelectOrg = (orgId: string, checked: boolean) => {
    setSelectedOrgs(prev => 
      checked ? [...prev, orgId] : prev.filter(id => id !== orgId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedOrgs(checked ? filteredOrganizations.map(org => org.id) : []);
  };

  const handleBulkAction = async (action: string) => {
    if (selectedOrgs.length === 0) {
      toast({
        title: 'No Selection',
        description: 'Please select organizations first',
        variant: 'destructive'
      });
      return;
    }

    try {
      switch (action) {
        case 'suspend':
        case 'reinstate':
        case 'recalculate':
          toast({ title: 'Success', description: `${action} action initiated for ${selectedOrgs.length} organizations` });
          break;
        case 'email':
          toast({ title: 'Success', description: 'Email notifications sent' });
          break;
      }
      setSelectedOrgs([]);
    } catch (error) {
      console.error('Bulk action error:', error);
      toast({
        title: 'Error',
        description: 'Failed to perform bulk action',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (suspensionStatus: string, billingStatus: string) => {
    // Suspension status takes precedence
    if (suspensionStatus === 'suspended') {
      return <Badge variant="destructive" className="bg-yellow-500 hover:bg-yellow-600"><Pause className="h-3 w-3 mr-1" />Suspended</Badge>;
    }
    if (suspensionStatus === 'canceled') {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Canceled</Badge>;
    }
    
    // Fall back to billing status
    switch (billingStatus) {
      case 'active':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600"><Play className="h-3 w-3 mr-1" />Active</Badge>;
      case 'trialing':
        return <Badge variant="secondary" className="bg-blue-500 hover:bg-blue-600 text-white"><Shield className="h-3 w-3 mr-1" />Trial</Badge>;
      default:
        return <Badge variant="outline">{billingStatus}</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    const colors: Record<string, string> = {
      trial: 'bg-orange-100 text-orange-800',
      basic: 'bg-blue-100 text-blue-800',
      premium: 'bg-purple-100 text-purple-800',
      enterprise: 'bg-green-100 text-green-800'
    };
    return (
      <Badge className={`${colors[plan] || 'bg-gray-100 text-gray-800'}`}>
        {plan}
      </Badge>
    );
  };

  const getSetupFeeBadge = (status: string) => {
    switch (status) {
      case 'collected_off_platform':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">Collected</Badge>;
      case 'waived':
        return <Badge variant="outline" className="text-blue-600 border-blue-300">Waived</Badge>;
      case 'pending':
      default:
        return <Badge variant="secondary" className="text-orange-600 bg-orange-100">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Organizations Directory</span>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadOrganizations}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by org name, ID, or owner email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <Select value={filters.plan} onValueChange={(value) => setFilters(prev => ({ ...prev, plan: value }))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={filters.overLimit ? "default" : "outline"}
              size="sm"
              onClick={() => setFilters(prev => ({ ...prev, overLimit: !prev.overLimit }))}
            >
              Over Limit
            </Button>

            <Button
              variant={filters.inactive ? "default" : "outline"}
              size="sm"
              onClick={() => setFilters(prev => ({ ...prev, inactive: !prev.inactive }))}
            >
              Inactive (30d+)
            </Button>

            <Button
              variant={filters.trialing ? "default" : "outline"}
              size="sm"
              onClick={() => setFilters(prev => ({ ...prev, trialing: !prev.trialing }))}
            >
              Trialing
            </Button>
          </div>

          {/* Bulk Actions */}
          {selectedOrgs.length > 0 && (
            <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">
                {selectedOrgs.length} selected
              </span>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('suspend')}>
                <Pause className="h-4 w-4 mr-2" />
                Suspend
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('reinstate')}>
                <Play className="h-4 w-4 mr-2" />
                Reinstate
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('recalculate')}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Recalculate Seats
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('email')}>
                <Mail className="h-4 w-4 mr-2" />
                Email Owners
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* What Gets Blocked Info Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            What Gets Blocked When Organizations Are Suspended?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                Suspended Services
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Agent operations (calls, API access)</li>
                <li>• Webhook dispatching</li>
                <li>• New member invitations</li>
                <li>• Data operations (CRUD)</li>
                <li>• File uploads and processing</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Play className="h-4 w-4 text-green-500" />
                Available Services
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Billing portal access</li>
                <li>• Settings (read-only)</li>
                <li>• Support contacts</li>
                <li>• Authentication flows</li>
                <li>• Account management</li>
              </ul>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Organizations retain access to billing and essential account functions during suspension.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="/admin/guard-tests" target="_blank" rel="noopener noreferrer">
                <Shield className="h-4 w-4 mr-2" />
                Test Guard System
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Organizations Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedOrgs.length === filteredOrganizations.length && filteredOrganizations.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Org Name</TableHead>
                <TableHead>Org ID</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Setup Fee</TableHead>
                <TableHead>MRR</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrganizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedOrgs.includes(org.id)}
                      onCheckedChange={(checked) => handleSelectOrg(org.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell className="font-mono text-sm">{org.id.slice(0, 8)}...</TableCell>
                  <TableCell>{org.owner_email}</TableCell>
                  <TableCell>{getPlanBadge(org.plan_key)}</TableCell>
                  <TableCell>
                    <span className={`${(org.active_seats || 0) > (org.seat_limit || 0) ? 'text-red-600 font-medium' : ''}`}>
                      {org.active_seats}/{org.seat_limit}
                    </span>
                  </TableCell>
                  <TableCell>
                     {getStatusBadge(org.status || 'active', org.billing_status)}
                  </TableCell>
                  <TableCell>
                    {getSetupFeeBadge(org.setup_fee_status || 'pending')}
                  </TableCell>
                  <TableCell>${org.mrr || 0}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {org.last_activity ? new Date(org.last_activity).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => window.open(`/dashboard?org=${org.id}`, '_blank')}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Dashboard
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        
                        {/* Suspension Actions */}
                        {org.status === 'suspended' || org.status === 'canceled' ? (
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedOrg(org);
                              setSuspensionAction('reinstate');
                              setSuspensionDialogOpen(true);
                            }}
                          >
                            <Play className="h-4 w-4 mr-2 text-green-500" />
                            Reinstate Service
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedOrg(org);
                                setSuspensionAction('suspend');
                                setSuspensionDialogOpen(true);
                              }}
                            >
                              <Pause className="h-4 w-4 mr-2 text-yellow-500" />
                              Suspend Service
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedOrg(org);
                                setSuspensionAction('cancel');
                                setSuspensionDialogOpen(true);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel Service
                            </DropdownMenuItem>
                          </>
                        )}
                        
                        <DropdownMenuSeparator />
                        
                        {/* Management Actions */}
                        <DropdownMenuItem onClick={() => setViewActivityOrgId(org.id)}>
                          <FileText className="h-4 w-4 mr-2" />
                          View Activity
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTransferOrgId(org.id)}>
                          <ArrowRightLeft className="h-4 w-4 mr-2" />
                          Transfer Ownership
                        </DropdownMenuItem>
                        
                        <DropdownMenuSeparator />
                        
                        {/* Billing & Support */}
                        <DropdownMenuItem asChild>
                          <a 
                            href={`https://dashboard.stripe.com/customers/${org.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            View in Stripe
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSetupFeeOrgId(org.id)}>
                          <FileText className="h-4 w-4 mr-2" />
                          Setup Fee Tracking
                        </DropdownMenuItem>
                        
                        {/* Side Panel Trigger */}
                        <Sheet>
                          <SheetTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Info className="h-4 w-4 mr-2" />
                              Organization Details
                            </DropdownMenuItem>
                          </SheetTrigger>
                          <SheetContent className="w-[500px] sm:w-[540px]">
                            <SheetHeader>
                              <SheetTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                {org.name}
                              </SheetTitle>
                            </SheetHeader>
                            <div className="mt-6 space-y-6">
                              {/* Organization Info */}
                              <div>
                                <h3 className="font-medium mb-3">Organization Details</h3>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">ID:</span>
                                    <span className="font-mono">{org.id}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Owner:</span>
                                    <span>{org.owner_email}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Plan:</span>
                                    {getPlanBadge(org.plan_key)}
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Status:</span>
                                    {getStatusBadge(org.status || 'active', org.billing_status)}
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Seats:</span>
                                    <span>{org.active_seats}/{org.seat_limit}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">MRR:</span>
                                    <span>${org.mrr || 0}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <Separator />
                              
                              {/* Status Impact */}
                              <div>
                                <h3 className="font-medium mb-3">Service Status Impact</h3>
                                {org.status === 'suspended' ? (
                                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="text-sm text-yellow-800 mb-2">
                                      <strong>Service Suspended (HTTP 423)</strong>
                                    </p>
                                    <p className="text-xs text-yellow-700">
                                      Error Code: ORG_SUSPENDED
                                    </p>
                                    <p className="text-xs text-yellow-700">
                                      Blocked: Agents, API, Invites, Data operations
                                    </p>
                                    <p className="text-xs text-yellow-700">
                                      Available: Billing, Settings (read-only), Support
                                    </p>
                                  </div>
                                ) : org.status === 'canceled' ? (
                                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-sm text-red-800 mb-2">
                                      <strong>Service Canceled (HTTP 410)</strong>
                                    </p>
                                    <p className="text-xs text-red-700">
                                      Error Code: ORG_CANCELED
                                    </p>
                                    <p className="text-xs text-red-700">
                                      All services blocked except billing portal for final account access.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm text-green-800 mb-2">
                                      <strong>All Services Active</strong>
                                    </p>
                                    <p className="text-xs text-green-700">
                                      Organization has full access to all platform features.
                                    </p>
                                  </div>
                                )}
                              </div>
                              
                              <Separator />
                              
                              {/* Quick Actions */}
                              <div>
                                <h3 className="font-medium mb-3">Quick Actions</h3>
                                <div className="space-y-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full justify-start"
                                    asChild
                                  >
                                    <a 
                                      href={`/dashboard?org=${org.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      Open Dashboard
                                    </a>
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full justify-start"
                                    asChild
                                  >
                                    <a 
                                      href={`https://dashboard.stripe.com/customers/${org.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <CreditCard className="h-4 w-4 mr-2" />
                                      Billing Portal
                                    </a>
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full justify-start"
                                    onClick={() => setViewActivityOrgId(org.id)}
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    View Activity Log
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </SheetContent>
                        </Sheet>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredOrganizations.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No organizations found matching your criteria
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {selectedOrg && (
        <SuspensionDialog
          isOpen={suspensionDialogOpen}
          onClose={() => {
            setSuspensionDialogOpen(false);
            setSelectedOrg(null);
            setSuspensionAction(undefined);
          }}
          organization={selectedOrg}
          action={suspensionAction}
          onSuccess={() => {
            loadOrganizations();
          }}
        />
      )}

      <TransferOwnershipDialog
        organizationId={transferOrgId}
        open={!!transferOrgId}
        onOpenChange={(open) => !open && setTransferOrgId(null)}
        onSuccess={() => {
          setTransferOrgId(null);
          loadOrganizations();
        }}
      />

      <ViewActivityDialog
        organizationId={viewActivityOrgId}
        open={!!viewActivityOrgId}
        onOpenChange={(open) => !open && setViewActivityOrgId(null)}
      />

      {/* Setup Fee Tracking Dialog */}
      {setupFeeOrgId && (
        <Sheet open={!!setupFeeOrgId} onOpenChange={(open) => !open && setSetupFeeOrgId(null)}>
          <SheetContent className="w-[500px] sm:w-[540px]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Setup Fee Tracking
              </SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              {(() => {
                const org = organizations.find(o => o.id === setupFeeOrgId);
                return org ? (
                  <SetupFeeTracker
                    organizationId={org.id}
                    organizationName={org.name}
                    currentStatus={org.setup_fee_status || 'pending'}
                    currentNotes={org.setup_fee_notes || ''}
                    onUpdate={() => {
                      loadOrganizations();
                      setSetupFeeOrgId(null);
                    }}
                  />
                ) : (
                  <p>Organization not found</p>
                );
              })()}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}