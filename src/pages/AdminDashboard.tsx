import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserOrganization } from '@/hooks/useUserOrganization';
import { getEnvironmentConfig } from '@/lib/environment';
import { 
  Search, 
  BarChart3, 
  Building2, 
  Users, 
  CreditCard, 
  TrendingUp, 
  Bot, 
  FileText, 
  Settings,
  AlertTriangle,
  TestTube,
  ExternalLink
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrganizationsDirectory } from '@/components/admin/OrganizationsDirectory';
import { MembersAdmin } from '@/components/admin/MembersAdmin';
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard';
import { BillingAdmin } from '@/components/admin/BillingAdmin';
import { AgentCatalogAdmin } from '@/components/admin/AgentCatalogAdmin';
import { AdminLogsViewer } from '@/components/admin/AdminLogsViewer';
import { AdminBackfill } from '@/components/admin/AdminBackfill';
import { EmailIntegrations } from '@/components/admin/EmailIntegrations';
import { FeatureFlags } from '@/components/admin/FeatureFlags';
import { DataFixes } from '@/components/admin/DataFixes';

const adminTabs = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'agent-catalog', label: 'Agent Catalog', icon: Bot },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'utilities', label: 'Utilities', icon: Settings },
  { 
    id: 'tests', 
    label: 'Hidden Tests', 
    icon: TestTube, 
    condition: () => process.env.NODE_ENV === 'development' 
  }
];

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { organization, isOwner, loading: orgLoading } = useUserOrganization();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasAccess, setHasAccess] = useState(false);
  const envConfig = getEnvironmentConfig();

  useEffect(() => {
    if (authLoading || orgLoading) return;

    // Check if user is org owner or superadmin
    const userHasAccess = isOwner; // TODO: Add superadmin check when implemented
    
    if (!userHasAccess) {
      navigate('/dashboard');
      return;
    }

    setHasAccess(true);
  }, [user, isOwner, authLoading, orgLoading, navigate]);

  if (authLoading || orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
              {!envConfig.isProduction && (
                <Badge variant="destructive" className="ml-2">
                  Dev Environment
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search orgs, users, subscriptions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-96"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {!envConfig.isProduction && (
        <Alert className="mx-6 mt-4 border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Dev Only:</strong> Test environment active (test level: {envConfig.testLevel})
          </AlertDescription>
        </Alert>
      )}

      <div className="container mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-8">
            {adminTabs
              .filter(tab => !tab.condition || tab.condition())
              .map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  className="flex items-center space-x-2"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">156</div>
                  <p className="text-xs text-muted-foreground">+12% from last month</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">2,847</div>
                  <p className="text-xs text-muted-foreground">+8% from last month</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$45,231</div>
                  <p className="text-xs text-muted-foreground">+23% from last month</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
                  <Bot className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">428</div>
                  <p className="text-xs text-muted-foreground">+5% from last month</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="organizations">
            <OrganizationsDirectory />
          </TabsContent>

          <TabsContent value="members">
            <MembersAdmin />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsDashboard />
          </TabsContent>

          <TabsContent value="billing">
            <BillingAdmin />
          </TabsContent>

          <TabsContent value="agent-catalog">
            <AgentCatalogAdmin />
          </TabsContent>

          <TabsContent value="logs">
            <AdminLogsViewer />
          </TabsContent>

          <TabsContent value="utilities">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Admin Utilities</CardTitle>
                  <CardContent className="text-sm text-muted-foreground">
                    Safe administrative tools for system maintenance and debugging
                  </CardContent>
                </CardHeader>
              </Card>
              
              <div className="grid gap-6">
                <AdminBackfill />
                <EmailIntegrations />
                <FeatureFlags />
                <DataFixes />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tests">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5" />
                  Hidden Tests
                  <Badge variant="secondary">Development Only</Badge>
                </CardTitle>
                <CardContent className="text-sm text-muted-foreground">
                  Internal testing utilities only visible when RUN_TEST_LEVEL ≠ off
                </CardContent>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Alert>
                    <TestTube className="h-4 w-4" />
                    <AlertDescription>
                      These tests are hidden from customers and only available in development environments.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="w-full">
                    <a href="/admin/tests/invites" className="inline-flex items-center gap-2 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md text-sm font-medium transition-colors w-full justify-center">
                      <ExternalLink className="h-4 w-4" />
                      Invite System Tests
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}