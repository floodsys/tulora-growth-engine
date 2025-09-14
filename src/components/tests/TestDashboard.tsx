import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  Phone, 
  Calendar, 
  Settings, 
  BarChart3, 
  Shield, 
  Database, 
  Mail, 
  CreditCard, 
  Flag, 
  UserCheck,
  Activity,
  TestTube,
  Globe,
  FileText,
  Lock,
  AlertTriangle,
  UserPlus,
  Pause,
  RefreshCw,
  Eye,
  Bell
} from "lucide-react";
import { OrgSwitcherTests } from "./OrgSwitcherTests"
import { ProfileUpdateTests } from "./ProfileUpdateTests"
import { DemoArtifactLinter } from "./DemoArtifactLinter"
import { OrganizationProfileTests } from "./OrganizationProfileTests"

import { HiddenTestsRunner } from "./HiddenTestsRunner"
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { OrganizationsDirectory } from "@/components/admin/OrganizationsDirectory";
import { MembersAdmin } from "@/components/admin/MembersAdmin";
import { BillingAdmin } from "@/components/admin/BillingAdmin";
import { SuperadminManagement } from "@/components/admin/SuperadminManagement";
import { DataFixes } from "@/components/admin/DataFixes";
import { FeatureFlags } from "@/components/admin/FeatureFlags";
import { EmailIntegrations } from "@/components/admin/EmailIntegrations";
import { AdminTestRunner } from "@/components/admin/AdminTestRunner";
import { AdminSessionPanel } from "@/components/admin/AdminSessionPanel";
import SuperadminTestHarness from "@/components/admin/SuperadminTestHarness";
import GuardTests from "@/components/admin/GuardTests";
import { StepUpAuthTest } from "@/components/admin/StepUpAuthTest";
import { InviteAcceptanceTests } from "@/components/admin/InviteAcceptanceTests";
import { OrgStatusGuardTest } from "@/components/admin/OrgStatusGuardTest";
import { RateLimitTest } from "@/components/admin/RateLimitTest";
import { SuspensionSystemTest } from "@/components/admin/SuspensionSystemTest";
import { AdminBackfill } from "@/components/admin/AdminBackfill";
import { TelemetryDashboard } from "@/components/admin/TelemetryDashboard";
import { AdminLogsViewer } from "@/components/admin/AdminLogsViewer";
import { InviteSystemTests } from "@/components/InviteSystemTests";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSuperadmin } from "@/hooks/useSuperadmin";
import { useToast } from "@/hooks/use-toast";

export function TestDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSuperadmin } = useSuperadmin();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Tests tab is always visible to superadmins
  const showTests = isSuperadmin;
  
  // Available tabs
  const availableTabs = ["overview", "system", "management", ...(showTests ? ["tests"] : []), "diagnostics"];
  
  // Get current tab from URL or default to overview
  const currentTab = searchParams.get("tab") || "overview";
  
  // Handle tab changes and URL sync
  const handleTabChange = (newTab: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("tab", newTab);
    setSearchParams(newSearchParams);
  };
  
  // Handle case where tests tab is requested but disabled
  useEffect(() => {
    if (currentTab === "tests" && !showTests) {
      toast({
        title: "Tests Disabled",
        description: "Tests are disabled in this environment.",
        variant: "destructive",
      });
      handleTabChange("overview");
    }
  }, [currentTab, showTests, toast]);
  
  // Ensure current tab is valid
  const validTab = availableTabs.includes(currentTab) ? currentTab : "overview";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          System management, monitoring, and administration tools
        </p>
      </div>

      <Tabs value={validTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={`grid w-full ${showTests ? 'grid-cols-5' : 'grid-cols-4'}`}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="management">Management</TabsTrigger>
          {showTests && <TabsTrigger value="tests">Tests</TabsTrigger>}
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          {/* Voice System Management */}
          <Card>
            <CardHeader>
              <CardTitle>Voice System Management</CardTitle>
              <CardDescription>
                Monitor and manage voice agents and calls
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link to="/admin/agents">
                  <Button variant="outline" className="w-full justify-start h-auto p-4">
                    <Users className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-medium">Voice Agents</div>
                      <div className="text-sm text-muted-foreground">Manage AI voice agents</div>
                    </div>
                  </Button>
                </Link>
                
                <Link to="/admin/calls">
                  <Button variant="outline" className="w-full justify-start h-auto p-4">
                    <Phone className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-medium">Call Logs</div>
                      <div className="text-sm text-muted-foreground">Review call activity</div>
                    </div>
                  </Button>
                </Link>

                <Link to="/admin/stripe-config">
                  <Button variant="outline" className="w-full justify-start h-auto p-4">
                    <Settings className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-medium">Stripe Config</div>
                      <div className="text-sm text-muted-foreground">Payment configuration</div>
                    </div>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Analytics */}
          <Card>
            <CardHeader>
              <CardTitle>Analytics Dashboard</CardTitle>
              <CardDescription>
                System-wide analytics and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AnalyticsDashboard />
            </CardContent>
          </Card>

          {/* Admin Session */}
          <Card>
            <CardHeader>
              <CardTitle>Admin Session Status</CardTitle>
              <CardDescription>
                Current admin session and authentication status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminSessionPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          {/* System Administration */}
          <Card>
            <CardHeader>
              <CardTitle>System Administration</CardTitle>
              <CardDescription>
                Core system management and configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button 
                  variant="outline" 
                  className="h-auto p-4 justify-start"
                  onClick={() => document.getElementById('data-fixes')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <Database className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Data Fixes</div>
                    <div className="text-sm text-muted-foreground">Database maintenance</div>
                  </div>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-auto p-4 justify-start"
                  onClick={() => document.getElementById('feature-flags')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <Flag className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Feature Flags</div>
                    <div className="text-sm text-muted-foreground">Feature toggles</div>
                  </div>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-auto p-4 justify-start"
                  onClick={() => document.getElementById('email-integrations')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <Mail className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Email Integration</div>
                    <div className="text-sm text-muted-foreground">Email configuration</div>
                  </div>
                </Button>

                <Link to="/admin/notifications">
                  <Button 
                    variant="outline" 
                    className="h-auto p-4 justify-start w-full"
                  >
                    <Bell className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-medium">Notifications & CRM</div>
                      <div className="text-sm text-muted-foreground">Email & CRM testing</div>
                    </div>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Data Fixes Component */}
          <div id="data-fixes">
            <DataFixes />
          </div>

          {/* Feature Flags Component */}
          <div id="feature-flags">
            <FeatureFlags />
          </div>

          {/* Email Integrations Component */}
          <div id="email-integrations">
            <EmailIntegrations />
          </div>
        </TabsContent>

        <TabsContent value="management" className="space-y-6">
          {/* User & Organization Management */}
          <Card>
            <CardHeader>
              <CardTitle>Organizations</CardTitle>
              <CardDescription>
                Manage organizations and their settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrganizationsDirectory />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Members Administration</CardTitle>
              <CardDescription>
                Manage users and their roles across organizations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MembersAdmin />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing Administration</CardTitle>
              <CardDescription>
                Monitor and manage billing and subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BillingAdmin />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Superadmin Management</CardTitle>
              <CardDescription>
                Manage superadmin users and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SuperadminManagement />
            </CardContent>
          </Card>
        </TabsContent>

        {showTests && (
          <TabsContent value="tests" className="space-y-6">
            {/* Comprehensive Admin Tests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5" />
                  Admin Test Runner
                </CardTitle>
                <CardDescription>
                  Run comprehensive system tests and diagnostics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminTestRunner />
              </CardContent>
            </Card>

            {/* Superadmin Tests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Superadmin Test Harness
                </CardTitle>
                <CardDescription>
                  Test superadmin authorization and access controls
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SuperadminTestHarness />
              </CardContent>
            </Card>

            {/* Security Tests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Security & Auth Tests
                </CardTitle>
                <CardDescription>
                  Authentication, authorization, and security tests
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Guard Tests
                  </h4>
                  <GuardTests />
                </div>
                
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Step-Up Authentication
                  </h4>
                  <StepUpAuthTest />
                </div>
                
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Rate Limiting
                  </h4>
                  <RateLimitTest />
                </div>
              </CardContent>
            </Card>

            {/* Organization & User Tests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Organization & User Tests
                </CardTitle>
                <CardDescription>
                  Test organization management, user roles, and permissions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Invite System Tests
                  </h4>
                  <InviteSystemTests />
                </div>
                
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Invite Acceptance Tests
                  </h4>
                  <InviteAcceptanceTests />
                </div>
                
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Pause className="h-4 w-4" />
                    Organization Status Tests
                  </h4>
                  <OrgStatusGuardTest />
                </div>
                
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Pause className="h-4 w-4" />
                    Suspension System Tests
                  </h4>
                  <SuspensionSystemTest />
                </div>
              </CardContent>
            </Card>

            {/* System Tests */}
            <Card>
              <CardHeader>
                <CardTitle>System Tests</CardTitle>
                <CardDescription>
                  Organization system testing, routing, RBAC, and integrity checks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  <OrganizationProfileTests />
                  <HiddenTestsRunner />
                  <OrgSwitcherTests />
                  <ProfileUpdateTests />
                  <DemoArtifactLinter />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="diagnostics" className="space-y-6">
          {/* Admin Session & Diagnostics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Admin Session Status
              </CardTitle>
              <CardDescription>
                Current admin session and authentication status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminSessionPanel />
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Data Management & Backfill
              </CardTitle>
              <CardDescription>
                Database maintenance and data backfill operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminBackfill />
            </CardContent>
          </Card>

          {/* Telemetry Dashboard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Telemetry Dashboard
              </CardTitle>
              <CardDescription>
                System telemetry and monitoring data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TelemetryDashboard />
            </CardContent>
          </Card>

          {/* Admin Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Admin Logs Viewer
              </CardTitle>
              <CardDescription>
                View and analyze admin activity logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminLogsViewer />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}