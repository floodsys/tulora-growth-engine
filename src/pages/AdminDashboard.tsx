import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useMFAVerification } from '@/hooks/useMFAVerification';
import { useAdminSessionPolicy } from '@/hooks/useAdminSessionPolicy';
import { MFASetup } from '@/components/admin/MFASetup';
import { MFAVerification } from '@/components/admin/MFAVerification';
import { AdminSessionExpiredModal } from '@/components/admin/AdminSessionExpiredModal';
import { AdminModeChip } from '@/components/ui/AdminModeChip';
import { BUILD_ID } from '@/lib/build-info';
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
  ExternalLink,
  Shield
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
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
import { AdminTestRunner } from '@/components/admin/AdminTestRunner';
import { SuperadminManagement } from '@/components/admin/SuperadminManagement';
import SuperadminTestHarness from '@/components/admin/SuperadminTestHarness';
import GuardTests from '@/components/admin/GuardTests';
import { SuspensionSystemTest } from '@/components/admin/SuspensionSystemTest';
import { OrgStatusGuardTest } from '@/components/admin/OrgStatusGuardTest';
import { StepUpAuthTest } from '@/components/admin/StepUpAuthTest';
import { RateLimitTest } from '@/components/admin/RateLimitTest';
import { InviteSystemTest } from '@/components/admin/InviteSystemTest';
import { InviteAcceptanceTests } from '@/components/admin/InviteAcceptanceTests';

const adminTabs = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'agent-catalog', label: 'Agent Catalog', icon: Bot },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'utilities', label: 'Utilities', icon: Settings },
  { id: 'superadmins', label: 'Superadmins', icon: Shield },
  { id: 'auth-test', label: 'Auth Test', icon: AlertTriangle },
  { 
    id: 'tests', 
    label: 'Hidden Tests', 
    icon: TestTube, 
    condition: () => process.env.NODE_ENV === 'development' 
  }
];

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, isChecking, LoadingComponent } = useAdminAccess();
  const mfaStatus = useMFAVerification(hasAccess);
  const { sessionExpired, sessionAgeHours, maxAllowedHours, forceReLogin } = useAdminSessionPolicy();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const envConfig = getEnvironmentConfig();

  // Loading state while checking access
  if (isChecking) {
    return <LoadingComponent />;
  }

  // Access denied is handled by useAdminAccess hook
  if (!hasAccess) {
    return null; // useAdminAccess will handle redirect
  }

  // MFA enforcement for superadmins
  if (mfaStatus.needsSetup) {
    return (
      <MFASetup 
        onSetupComplete={() => mfaStatus.refreshMFAStatus()}
        onCancel={() => navigate('/dashboard')}
      />
    );
  }

  if (mfaStatus.needsVerification) {
    return (
      <MFAVerification 
        onVerificationSuccess={() => mfaStatus.markAsVerified()}
        onCancel={() => navigate('/dashboard')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
              <AdminModeChip environment={import.meta.env.MODE || 'development'} />
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

      <Alert className="mx-6 mt-4">
        <Shield className="h-4 w-4" />
        <AlertDescription>
          You are in <strong>Superadmin Mode</strong>. All actions are logged and audited. 
          Use these tools responsibly and only as necessary for platform management.
        </AlertDescription>
      </Alert>

      <div className="container mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-10">
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
                <AdminTestRunner />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="superadmins">
            <SuperadminManagement />
          </TabsContent>

          <TabsContent value="auth-test">
            <SuperadminTestHarness />
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
                  
                  <div className="space-y-4">
                    <div className="w-full">
                      <a href="/admin/tests/invites" className="inline-flex items-center gap-2 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md text-sm font-medium transition-colors w-full justify-center">
                        <ExternalLink className="h-4 w-4" />
                        Invite System Tests
                      </a>
                    </div>
                    
                    <div className="w-full">
                      <GuardTests />
                    </div>
                    
                    <div className="w-full">
                      <SuspensionSystemTest />
                    </div>

                    <div className="w-full">
                      <OrgStatusGuardTest />
                    </div>

                    <div className="w-full">
                      <StepUpAuthTest />
                    </div>

                    <div className="w-full">
                      <RateLimitTest />
                    </div>

                    <div className="w-full">
                      <InviteSystemTest />
                    </div>

                    <div className="w-full">
                      <InviteAcceptanceTests />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Admin Footer with Build ID */}
      <footer className="border-t bg-card mt-8">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-4">
              <span>Admin Dashboard</span>
              <span>•</span>
              <span>Build ID: <code className="bg-muted px-1 rounded text-xs">{BUILD_ID}</code></span>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="h-3 w-3" />
              <span>Superadmin Mode Active</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Admin Session Expired Modal */}
      <AdminSessionExpiredModal
        isOpen={sessionExpired}
        sessionAgeHours={sessionAgeHours}
        maxAllowedHours={maxAllowedHours}
        onForceReLogin={forceReLogin}
      />
    </div>
  );
}