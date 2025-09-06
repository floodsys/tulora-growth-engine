import { Link } from "react-router-dom";
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
  FileText
} from "lucide-react";
import { OrgSwitcherTests } from "./OrgSwitcherTests"
import { ProfileUpdateTests } from "./ProfileUpdateTests"
import { DemoArtifactLinter } from "./DemoArtifactLinter"
import { OrganizationProfileTests } from "./OrganizationProfileTests"
import { TeamsConsolidationTests } from "./TeamsConsolidationTests"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function TestDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          System management, monitoring, and administration tools
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="management">Management</TabsTrigger>
          <TabsTrigger value="tests">Tests</TabsTrigger>
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
                <Button variant="outline" className="h-auto p-4 justify-start">
                  <Database className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Data Fixes</div>
                    <div className="text-sm text-muted-foreground">Database maintenance</div>
                  </div>
                </Button>

                <Button variant="outline" className="h-auto p-4 justify-start">
                  <Flag className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Feature Flags</div>
                    <div className="text-sm text-muted-foreground">Feature toggles</div>
                  </div>
                </Button>

                <Button variant="outline" className="h-auto p-4 justify-start">
                  <Mail className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Email Integration</div>
                    <div className="text-sm text-muted-foreground">Email configuration</div>
                  </div>
                </Button>
              </div>
              
              <div className="mt-6 space-y-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Data Fixes</h4>
                  <DataFixes />
                </div>
                
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Feature Flags</h4>
                  <FeatureFlags />
                </div>
                
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Email Integrations</h4>
                  <EmailIntegrations />
                </div>
              </div>
            </CardContent>
          </Card>
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

        <TabsContent value="tests" className="space-y-6">
          {/* Admin Tests */}
          <Card>
            <CardHeader>
              <CardTitle>Admin Test Runner</CardTitle>
              <CardDescription>
                Run comprehensive system tests and diagnostics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminTestRunner />
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
                <TeamsConsolidationTests />
                <HiddenTestsRunner />
                <OrgSwitcherTests />
                <ProfileUpdateTests />
                <DemoArtifactLinter />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}