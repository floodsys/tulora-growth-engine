import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  CreditCard, 
  ExternalLink, 
  RefreshCw, 
  Search, 
  MoreHorizontal, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Users,
  Pause,
  Play,
  Gift,
  Receipt,
  Settings,
  Calendar,
  UserCheck
} from 'lucide-react';
import { SeatSyncDialog } from "./SeatSyncDialog";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';

interface SubscriptionSummary {
  id: string;
  organization_id: string;
  organization_name: string;
  owner_email: string;
  plan_key: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  quantity: number;
  payment_method_exists: boolean;
  past_due: boolean;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  mrr: number;
}

interface Invoice {
  id: string;
  amount_paid: number;
  currency: string;
  status: string;
  created: number;
  period_start: number;
  period_end: number;
  hosted_invoice_url?: string;
}

interface WebhookEvent {
  id: string;
  type: string;
  created: number;
  livemode: boolean;
  api_version: string;
}

interface Organization {
  id: string;
  name: string;
  plan_key: string;
  billing_status: string;
  entitlements?: {
    manual_activation?: {
      active: boolean;
      ends_at: string;
      notes?: string;
      set_by: string;
      set_at: string;
    };
  };
}

interface ChangePlanDialogProps {
  subscription: SubscriptionSummary;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newPlan: string) => void;
}

function ChangePlanDialog({ subscription, isOpen, onClose, onConfirm }: ChangePlanDialogProps) {
  const [newPlan, setNewPlan] = useState(subscription.plan_key);
  const [confirmText, setConfirmText] = useState('');
  const expectedText = `CHANGE ${subscription.organization_name.toUpperCase()}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Plan</DialogTitle>
          <DialogDescription>
            Change subscription plan for {subscription.organization_name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="current-plan">Current Plan</Label>
            <Input id="current-plan" value={subscription.plan_key} disabled />
          </div>
          <div>
            <Label htmlFor="new-plan">New Plan</Label>
            <Select value={newPlan} onValueChange={setNewPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Select new plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="confirm-text">
              Type "{expectedText}" to confirm
            </Label>
            <Input
              id="confirm-text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expectedText}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={() => onConfirm(newPlan)}
            disabled={confirmText !== expectedText || newPlan === subscription.plan_key}
          >
            Change Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CreditCouponDialogProps {
  subscription: SubscriptionSummary;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (type: 'credit' | 'coupon', amount: number, description: string) => void;
}

function CreditCouponDialog({ subscription, isOpen, onClose, onConfirm }: CreditCouponDialogProps) {
  const [type, setType] = useState<'credit' | 'coupon'>('credit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const expectedText = `ISSUE ${type.toUpperCase()}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue {type === 'credit' ? 'Credit' : 'Coupon'}</DialogTitle>
          <DialogDescription>
            Issue a {type} for {subscription.organization_name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="credit-type">Type</Label>
            <Select value={type} onValueChange={(value: 'credit' | 'coupon') => setType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit">Account Credit</SelectItem>
                <SelectItem value="coupon">Discount Coupon</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="amount">
              Amount ({type === 'credit' ? 'USD cents' : 'Percentage'})
            </Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={type === 'credit' ? '1000' : '10'}
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Reason for issuing credit/coupon"
            />
          </div>
          <div>
            <Label htmlFor="confirm-text">
              Type "{expectedText}" to confirm
            </Label>
            <Input
              id="confirm-text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expectedText}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={() => onConfirm(type, parseFloat(amount), description)}
            disabled={confirmText !== expectedText || !amount || !description}
          >
            Issue {type === 'credit' ? 'Credit' : 'Coupon'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BillingAdmin() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionSummary[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionSummary | null>(null);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [creditCouponOpen, setCreditCouponOpen] = useState(false);
  const [syncSeatOpen, setSyncSeatOpen] = useState(false);
  const [syncSeatData, setSyncSeatData] = useState<{
    organizationId: string;
    organizationName: string;
    currentQuantity: number;
    currentSeats: number;
    hasSubscription: boolean;
  } | null>(null);
  const [activeTab, setActiveTab] = useState('subscriptions');
  
  // Manual Access state
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'business'>('pro');
  const [manualEndsAt, setManualEndsAt] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [currentOrganizations, setCurrentOrganizations] = useState<Organization[]>([]);
  const [isManualAccessLoading, setIsManualAccessLoading] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    loadBillingData();
    loadOrganizations();
  }, []);

  const loadBillingData = async () => {
    try {
      setIsLoading(true);
      
      // Load subscription summaries
      const { data: subsData, error: subsError } = await supabase.functions.invoke('admin-billing-overview', {
        body: { action: 'list_subscriptions' }
      });

      if (subsError) {
        console.error('Subscriptions error:', subsError);
        throw subsError;
      }
      
      // Ensure subsData is an array, even if the API returns an error object
      const subscriptionsArray = Array.isArray(subsData) ? subsData : [];
      setSubscriptions(subscriptionsArray);

      // Load recent invoices
      const { data: invoicesData, error: invoicesError } = await supabase.functions.invoke('admin-billing-overview', {
        body: { action: 'list_invoices', limit: 50 }
      });

      if (invoicesError) {
        console.error('Invoices error:', invoicesError);
        throw invoicesError;
      }
      
      // Ensure invoicesData is an array
      const invoicesArray = Array.isArray(invoicesData) ? invoicesData : [];
      setInvoices(invoicesArray);

      // Load recent webhook events
      const { data: webhooksData, error: webhooksError } = await supabase.functions.invoke('admin-billing-overview', {
        body: { action: 'list_webhook_events', limit: 20 }
      });

      if (webhooksError) {
        console.error('Webhooks error:', webhooksError);
        throw webhooksError;
      }
      
      // Ensure webhooksData is an array
      const webhooksArray = Array.isArray(webhooksData) ? webhooksData : [];
      setWebhookEvents(webhooksArray);

    } catch (error: any) {
      console.error('Error loading billing data:', error);
      
      // Set empty arrays to prevent filter errors
      setSubscriptions([]);
      setInvoices([]);
      setWebhookEvents([]);
      
      toast({
        title: "Error loading billing data",
        description: error.message || "Failed to load billing information. Please check the console for more details.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, plan_key, billing_status, entitlements')
        .order('name');

      if (error) throw error;
      setCurrentOrganizations((data || []) as Organization[]);
    } catch (error: any) {
      console.error('Error loading organizations:', error);
      toast({
        title: "Error loading organizations",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 text-white"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-500 text-white"><Clock className="h-3 w-3 mr-1" />Trial</Badge>;
      case 'past_due':
        return <Badge className="bg-yellow-500 text-white"><AlertTriangle className="h-3 w-3 mr-1" />Past Due</Badge>;
      case 'canceled':
      case 'unpaid':
        return <Badge className="bg-red-500 text-white"><XCircle className="h-3 w-3 mr-1" />Canceled</Badge>;
      case 'suspended':
        return <Badge className="bg-gray-500 text-white"><Pause className="h-3 w-3 mr-1" />Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleOpenCustomerPortal = async (customerId: string, orgName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-billing-actions', {
        body: { 
          action: 'create_portal_session',
          customer_id: customerId 
        }
      });

      if (error) throw error;

      window.open(data.url, '_blank');
      
      toast({
        title: "Customer portal opened",
        description: `Opened billing portal for ${orgName}`,
      });
    } catch (error: any) {
      toast({
        title: "Error opening customer portal",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleChangePlan = async (newPlan: string) => {
    if (!selectedSubscription) return;

    try {
      const { data, error } = await supabase.functions.invoke('admin-billing-actions', {
        body: { 
          action: 'change_plan',
          subscription_id: selectedSubscription.stripe_subscription_id,
          new_plan: newPlan,
          org_id: selectedSubscription.organization_id
        }
      });

      if (error) throw error;

      toast({
        title: "Plan changed successfully",
        description: `Changed ${selectedSubscription.organization_name} to ${newPlan}`,
      });
      
      setChangePlanOpen(false);
      loadBillingData();
    } catch (error: any) {
      toast({
        title: "Error changing plan",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSyncSeats = async (subscription: SubscriptionSummary) => {
    try {
      // First, get current seat count to show diff
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('user_id', { count: 'exact' })
        .eq('organization_id', subscription.organization_id)
        .eq('seat_active', true);

      if (memberError) throw memberError;

      const currentSeats = memberData?.length || 0;
      
      setSyncSeatData({
        organizationId: subscription.organization_id,
        organizationName: subscription.organization_name,
        currentQuantity: subscription.quantity || 0,
        currentSeats,
        hasSubscription: !!subscription.stripe_subscription_id
      });
      setSyncSeatOpen(true);
    } catch (error: any) {
      toast({
        title: "Error preparing seat sync",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSuspendService = async (subscription: SubscriptionSummary, suspend: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-billing-actions', {
        body: { 
          action: suspend ? 'suspend_service' : 'reinstate_service',
          org_id: subscription.organization_id,
          subscription_id: subscription.stripe_subscription_id
        }
      });

      if (error) throw error;

      toast({
        title: `Service ${suspend ? 'suspended' : 'reinstated'}`,
        description: `${suspend ? 'Suspended' : 'Reinstated'} service for ${subscription.organization_name}`,
      });
      
      loadBillingData();
    } catch (error: any) {
      toast({
        title: `Error ${suspend ? 'suspending' : 'reinstating'} service`,
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleIssueCreditOrCoupon = async (type: 'credit' | 'coupon', amount: number, description: string) => {
    if (!selectedSubscription) return;

    try {
      const { data, error } = await supabase.functions.invoke('admin-billing-actions', {
        body: { 
          action: type === 'credit' ? 'issue_credit' : 'create_coupon',
          customer_id: selectedSubscription.stripe_customer_id,
          amount,
          description,
          org_id: selectedSubscription.organization_id
        }
      });

      if (error) throw error;

      toast({
        title: `${type === 'credit' ? 'Credit' : 'Coupon'} issued successfully`,
        description: `Issued ${type} for ${selectedSubscription.organization_name}`,
      });
      
      setCreditCouponOpen(false);
      loadBillingData();
    } catch (error: any) {
      toast({
        title: `Error issuing ${type}`,
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleManualAccessAction = async (action: 'enable' | 'extend' | 'deactivate') => {
    if (!selectedOrgId) {
      toast({
        title: "Error",
        description: "Please select an organization",
        variant: "destructive",
      });
      return;
    }

    setIsManualAccessLoading(true);

    try {
      let requestBody;
      
      if (action === 'deactivate') {
        requestBody = {
          orgId: selectedOrgId,
          planKey: 'trial',
          manual: { active: false }
        };
      } else {
        // Default to 90 days from now if not specified
        const endsAt = manualEndsAt || addDays(new Date(), 90).toISOString();
        
        requestBody = {
          orgId: selectedOrgId,
          planKey: selectedPlan,
          manual: {
            active: true,
            ends_at: endsAt,
            notes: manualNotes
          }
        };
      }

      const { data, error } = await supabase.functions.invoke('admin-set-org-access', {
        body: requestBody
      });

      if (error) throw error;

      toast({
        title: "Manual access updated",
        description: `Successfully ${action === 'deactivate' ? 'deactivated' : 'enabled'} manual access`,
      });

      // Reset form
      setSelectedOrgId('');
      setSelectedPlan('pro');
      setManualEndsAt('');
      setManualNotes('');
      
      // Refresh data
      await Promise.all([loadBillingData(), loadOrganizations()]);
      
    } catch (error: any) {
      toast({
        title: "Error updating manual access",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsManualAccessLoading(false);
    }
  };

  const getCurrentOrgStatus = () => {
    if (!selectedOrgId) return null;
    return currentOrganizations.find(org => org.id === selectedOrgId);
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = sub.organization_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         sub.owner_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    const matchesPlan = planFilter === 'all' || sub.plan_key === planFilter;
    
    return matchesSearch && matchesStatus && matchesPlan;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Billing Administration</h2>
          <p className="text-muted-foreground">
            Central billing oversight and subscription management
          </p>
        </div>
        <Button onClick={loadBillingData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="manual-access">Manual Access</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="webhooks">Webhook Events</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search organizations or emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subscriptions Table */}
          <Card>
            <CardHeader>
              <CardTitle>Subscription Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Seats</TableHead>
                    <TableHead>MRR</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((subscription) => (
                    <TableRow key={subscription.id}>
                      <TableCell className="font-medium">
                        {subscription.organization_name}
                      </TableCell>
                      <TableCell>{subscription.owner_email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{subscription.plan_key}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                      <TableCell>
                        {subscription.current_period_end ? 
                          format(new Date(subscription.current_period_end), "MMM d, yyyy") : 
                          'N/A'
                        }
                      </TableCell>
                      <TableCell>{subscription.quantity}</TableCell>
                      <TableCell>${subscription.mrr}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {subscription.payment_method_exists ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          {subscription.past_due && (
                            <AlertTriangle className="h-4 w-4 text-yellow-500 ml-1" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleOpenCustomerPortal(subscription.stripe_customer_id, subscription.organization_name)}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Customer Portal
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedSubscription(subscription);
                                setChangePlanOpen(true);
                              }}
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              Change Plan
                            </DropdownMenuItem>
                            <DropdownMenuItem
                               onClick={() => handleSyncSeats(subscription)}
                             >
                               <Users className="h-4 w-4 mr-2" />
                               Recalculate Seats
                             </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleSuspendService(subscription, subscription.status !== 'suspended')}
                            >
                              {subscription.status === 'suspended' ? (
                                <><Play className="h-4 w-4 mr-2" />Reinstate Service</>
                              ) : (
                                <><Pause className="h-4 w-4 mr-2" />Suspend Service</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedSubscription(subscription);
                                setCreditCouponOpen(true);
                              }}
                            >
                              <Gift className="h-4 w-4 mr-2" />
                              Issue Credit/Coupon
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual-access" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Manual Access Control
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Manually enable Starter or Business plans for organizations with a 90-day default window
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Organization Selection */}
              <div className="space-y-2">
                <Label htmlFor="org-select">Organization</Label>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an organization..." />
                  </SelectTrigger>
                  <SelectContent>
                    {currentOrganizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name} - {org.plan_key} 
                        {org.entitlements?.manual_activation?.active && (
                          <span className="text-green-600 ml-2">(Manual Active)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Current Status Display */}
              {selectedOrgId && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Current Status
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Plan:</span>
                      <Badge variant="outline" className="ml-2">
                        {getCurrentOrgStatus()?.plan_key === 'pro' ? 'Starter' : getCurrentOrgStatus()?.plan_key === 'business' ? 'Business' : getCurrentOrgStatus()?.plan_key}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Billing Status:</span>
                      <span className="ml-2">{getCurrentOrgStatus()?.billing_status}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Manual Access:</span>
                      <Badge className={`ml-2 ${getCurrentOrgStatus()?.entitlements?.manual_activation?.active ? 'bg-green-500' : 'bg-gray-500'}`}>
                        {getCurrentOrgStatus()?.entitlements?.manual_activation?.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {getCurrentOrgStatus()?.entitlements?.manual_activation?.active && (
                      <div>
                        <span className="text-muted-foreground">Ends At:</span>
                        <span className="ml-2">
                          {format(new Date(getCurrentOrgStatus()?.entitlements?.manual_activation?.ends_at || ''), "MMM d, yyyy")}
                        </span>
                      </div>
                    )}
                  </div>
                  {getCurrentOrgStatus()?.entitlements?.manual_activation?.notes && (
                    <div>
                      <span className="text-muted-foreground">Notes:</span>
                      <p className="mt-1 text-sm">{getCurrentOrgStatus()?.entitlements?.manual_activation?.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Manual Access Form */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plan-select">Plan</Label>
                  <Select value={selectedPlan} onValueChange={(value: 'pro' | 'business') => setSelectedPlan(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pro">Starter (pro)</SelectItem>
                      <SelectItem value="business">Business (business)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ends-at">Ends At</Label>
                  <Input
                    id="ends-at"
                    type="datetime-local"
                    value={manualEndsAt}
                    onChange={(e) => setManualEndsAt(e.target.value)}
                    placeholder="Default: +90 days"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty for default 90 days from now
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Optional notes about this manual access grant..."
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={() => handleManualAccessAction('enable')}
                  disabled={!selectedOrgId || isManualAccessLoading}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Enable Manual Access
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => handleManualAccessAction('extend')}
                  disabled={!selectedOrgId || isManualAccessLoading}
                  className="flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Extend/Update
                </Button>
                
                <Button
                  variant="destructive"
                  onClick={() => handleManualAccessAction('deactivate')}
                  disabled={!selectedOrgId || isManualAccessLoading}
                  className="flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Deactivate
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-xs">
                        {invoice.id}
                      </TableCell>
                      <TableCell>
                        ${(invoice.amount_paid / 100).toFixed(2)} {invoice.currency.toUpperCase()}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>
                        {format(new Date(invoice.created * 1000), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.period_start * 1000), "MMM d")} - {format(new Date(invoice.period_end * 1000), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {invoice.hosted_invoice_url && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={invoice.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                              <Receipt className="h-4 w-4 mr-1" />
                              View
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Webhook Events</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>API Version</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhookEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-mono text-xs">
                        {event.id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{event.type}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(event.created * 1000), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge className={event.livemode ? "bg-green-500 text-white" : "bg-yellow-500 text-white"}>
                          {event.livemode ? 'Live' : 'Test'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {event.api_version}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {selectedSubscription && (
        <>
          <ChangePlanDialog
            subscription={selectedSubscription}
            isOpen={changePlanOpen}
            onClose={() => {
              setChangePlanOpen(false);
              setSelectedSubscription(null);
            }}
            onConfirm={handleChangePlan}
          />
          <CreditCouponDialog
            subscription={selectedSubscription}
            isOpen={creditCouponOpen}
            onClose={() => {
              setCreditCouponOpen(false);
              setSelectedSubscription(null);
            }}
            onConfirm={handleIssueCreditOrCoupon}
          />
        </>
      )}

      <SeatSyncDialog
        isOpen={syncSeatOpen}
        onClose={() => setSyncSeatOpen(false)}
        onConfirm={loadBillingData}
        data={syncSeatData}
      />
    </div>
  );
}