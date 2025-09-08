import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Search, Filter, RefreshCw, TestTube, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Lead {
  id: string;
  inquiry_type: string;
  full_name: string;
  email: string;
  company?: string;
  message?: string;
  additional_requirements?: string;
  product_interest?: string;
  expected_volume_label?: string;
  crm_sync_status?: string;
  delivery_status?: string;
  created_at: string;
  ip_country?: string;
  utm_source?: string;
  status: string;
  // Mark test leads
  is_test_lead?: boolean;
}

export function LeadsDataViewer() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showTestLeads, setShowTestLeads] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      const { data, error } = await query;

      if (error) {
        console.error('Error loading leads:', error);
        toast({
          title: "Error Loading Leads",
          description: "Failed to load leads data",
          variant: "destructive"
        });
        return;
      }

      // Mark test leads based on common patterns
      const processedLeads = data.map(lead => ({
        ...lead,
        is_test_lead: isTestLead(lead)
      }));

      setLeads(processedLeads);
    } catch (error) {
      console.error('Error loading leads:', error);
      toast({
        title: "System Error",
        description: "Unable to connect to leads database",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isTestLead = (lead: any): boolean => {
    const testPatterns = [
      'test@',
      'example@',
      'demo@',
      '@test',
      '@example',
      'admin@',
      'support@',
      'noreply@'
    ];
    
    const testCompanies = [
      'test',
      'example',
      'demo', 
      'acme',
      'sample'
    ];

    const emailLower = lead.email?.toLowerCase() || '';
    const companyLower = lead.company?.toLowerCase() || '';
    const nameLower = lead.full_name?.toLowerCase() || '';

    return (
      testPatterns.some(pattern => emailLower.includes(pattern)) ||
      testCompanies.some(company => companyLower.includes(company)) ||
      nameLower.includes('test') ||
      nameLower.includes('demo')
    );
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchTerm || 
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesTestFilter = showTestLeads || !lead.is_test_lead;

    return matchesSearch && matchesStatus && matchesTestFilter;
  });

  const truncateText = (text: string, maxLength: number = 50): string => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'new': { variant: 'default' as const, label: 'New' },
      'contacted': { variant: 'secondary' as const, label: 'Contacted' },
      'qualified': { variant: 'default' as const, label: 'Qualified' },
      'closed': { variant: 'outline' as const, label: 'Closed' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.new;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getCRMSyncBadge = (status?: string) => {
    switch (status) {
      case 'synced':
        return <Badge className="bg-green-100 text-green-800">✓ Synced</Badge>;
      case 'failed':
        return <Badge variant="destructive">✗ Failed</Badge>;
      case 'pending':
        return <Badge variant="outline">⏳ Pending</Badge>;
      default:
        return <Badge variant="outline">—</Badge>;
    }
  };

  const getDeliveryBadge = (status?: string) => {
    switch (status) {
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800">✓ Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive">✗ Failed</Badge>;
      case 'pending':
        return <Badge variant="outline">⏳ Pending</Badge>;
      default:
        return <Badge variant="outline">—</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                📊 Lead Management Dashboard
                {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                View and manage contact form submissions with privacy-safe data display
              </p>
            </div>
            <Button onClick={loadLeads} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showTestLeads ? "default" : "outline"}
              size="sm"
              onClick={() => setShowTestLeads(!showTestLeads)}
            >
              <TestTube className="h-4 w-4 mr-2" />
              {showTestLeads ? 'Hide' : 'Show'} Test Leads
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="text-2xl font-bold">{leads.length}</div>
              <div className="text-sm text-muted-foreground">Total Leads</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold">{leads.filter(l => l.is_test_lead).length}</div>
              <div className="text-sm text-muted-foreground">Test Leads</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold">{leads.filter(l => l.crm_sync_status === 'synced').length}</div>
              <div className="text-sm text-muted-foreground">CRM Synced</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold">{leads.filter(l => l.delivery_status === 'delivered').length}</div>
              <div className="text-sm text-muted-foreground">Emails Sent</div>
            </Card>
          </div>

          {/* Leads Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Contact</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Message</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">CRM</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="border-t hover:bg-muted/30">
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{lead.full_name}</span>
                            {lead.is_test_lead && (
                              <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800">
                                <TestTube className="h-3 w-3 mr-1" />
                                Test
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{lead.email}</div>
                          {lead.company && (
                            <div className="text-sm text-muted-foreground">{lead.company}</div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">
                          {lead.inquiry_type === 'enterprise' ? '🏢 Enterprise' : '📞 Contact'}
                        </Badge>
                        {lead.product_interest && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {lead.product_interest}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="max-w-[200px]">
                          {lead.message && (
                            <div className="text-sm">
                              {truncateText(lead.message)}
                            </div>
                          )}
                          {lead.additional_requirements && (
                            <div className="text-sm text-muted-foreground">
                              {truncateText(lead.additional_requirements)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {getStatusBadge(lead.status)}
                      </td>
                      <td className="p-3">
                        {getCRMSyncBadge(lead.crm_sync_status)}
                      </td>
                      <td className="p-3">
                        {getDeliveryBadge(lead.delivery_status)}
                      </td>
                      <td className="p-3">
                        <div className="text-sm">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(lead.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="p-3">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setSelectedLead(lead)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Lead Details: {lead.full_name}
                                {lead.is_test_lead && (
                                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                                    <TestTube className="h-3 w-3 mr-1" />
                                    Test Lead
                                  </Badge>
                                )}
                              </DialogTitle>
                            </DialogHeader>
                            {selectedLead && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="font-medium mb-2">Contact Information</h4>
                                    <div className="space-y-2 text-sm">
                                      <div><strong>Name:</strong> {selectedLead.full_name}</div>
                                      <div><strong>Email:</strong> {selectedLead.email}</div>
                                      {selectedLead.company && <div><strong>Company:</strong> {selectedLead.company}</div>}
                                      {selectedLead.ip_country && <div><strong>Country:</strong> {selectedLead.ip_country}</div>}
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="font-medium mb-2">Status & Sync</h4>
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <strong className="text-sm">Status:</strong>
                                        {getStatusBadge(selectedLead.status)}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <strong className="text-sm">CRM:</strong>
                                        {getCRMSyncBadge(selectedLead.crm_sync_status)}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <strong className="text-sm">Email:</strong>
                                        {getDeliveryBadge(selectedLead.delivery_status)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {selectedLead.message && (
                                  <div>
                                    <h4 className="font-medium mb-2">Message</h4>
                                    <div className="p-3 bg-muted rounded-lg text-sm">
                                      {selectedLead.message}
                                    </div>
                                  </div>
                                )}
                                
                                {selectedLead.additional_requirements && (
                                  <div>
                                    <h4 className="font-medium mb-2">Additional Requirements</h4>
                                    <div className="p-3 bg-muted rounded-lg text-sm">
                                      {selectedLead.additional_requirements}
                                    </div>
                                  </div>
                                )}

                                {(selectedLead.utm_source || selectedLead.product_interest || selectedLead.expected_volume_label) && (
                                  <div>
                                    <h4 className="font-medium mb-2">Additional Details</h4>
                                    <div className="space-y-1 text-sm">
                                      {selectedLead.product_interest && <div><strong>Product Interest:</strong> {selectedLead.product_interest}</div>}
                                      {selectedLead.expected_volume_label && <div><strong>Expected Volume:</strong> {selectedLead.expected_volume_label}</div>}
                                      {selectedLead.utm_source && <div><strong>Source:</strong> {selectedLead.utm_source}</div>}
                                    </div>
                                  </div>
                                )}

                                <div className="text-xs text-muted-foreground pt-2 border-t">
                                  <div><strong>Lead ID:</strong> {selectedLead.id}</div>
                                  <div><strong>Created:</strong> {new Date(selectedLead.created_at).toLocaleString()}</div>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredLeads.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                {loading ? 'Loading leads...' : 'No leads found matching your filters'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}