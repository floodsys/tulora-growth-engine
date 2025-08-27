import React from 'react';
import { AdminSessionPanel } from '@/components/admin/AdminSessionPanel';
import { AdminTestRunner } from '@/components/admin/AdminTestRunner';
import SuperadminTestHarness from '@/components/admin/SuperadminTestHarness';
import { AdminBackfill } from '@/components/admin/AdminBackfill';
import GuardTests from '@/components/admin/GuardTests';
import { StepUpAuthTest } from '@/components/admin/StepUpAuthTest';
import { AdminLogsViewer } from '@/components/admin/AdminLogsViewer';
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard';
import { BillingAdmin } from '@/components/admin/BillingAdmin';
import { DataFixes } from '@/components/admin/DataFixes';
import { EmailIntegrations } from '@/components/admin/EmailIntegrations';
import { FeatureFlags } from '@/components/admin/FeatureFlags';
import { InviteAcceptanceTests } from '@/components/admin/InviteAcceptanceTests';
import { MembersAdmin } from '@/components/admin/MembersAdmin';
import { OrgStatusGuardTest } from '@/components/admin/OrgStatusGuardTest';
import { OrganizationActivityAdmin } from '@/components/admin/OrganizationActivityAdmin';
import { OrganizationsDirectory } from '@/components/admin/OrganizationsDirectory';
import { RateLimitTest } from '@/components/admin/RateLimitTest';
import { SuperadminManagement } from '@/components/admin/SuperadminManagement';
import { SuspensionSystemTest } from '@/components/admin/SuspensionSystemTest';
import { TelemetryDashboard } from '@/components/admin/TelemetryDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminDiagnostic() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="border-b pb-4">
            <h1 className="text-3xl font-bold">Admin Diagnostics & Tools</h1>
            <p className="text-muted-foreground mt-2">
              Comprehensive admin session diagnostics and testing tools
            </p>
          </div>

          <Tabs defaultValue="session" className="w-full">
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
              <TabsTrigger value="session">Session</TabsTrigger>
              <TabsTrigger value="tests">Tests</TabsTrigger>
              <TabsTrigger value="superadmin">Super</TabsTrigger>
              <TabsTrigger value="backfill">Backfill</TabsTrigger>
              <TabsTrigger value="guards">Guards</TabsTrigger>
              <TabsTrigger value="stepup">Step-Up</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="more">More</TabsTrigger>
            </TabsList>
            
            <TabsContent value="session" className="space-y-6">
              <AdminSessionPanel />
            </TabsContent>
            
            <TabsContent value="tests" className="space-y-6">
              <AdminTestRunner />
            </TabsContent>
            
            <TabsContent value="superadmin" className="space-y-6">
              <SuperadminTestHarness />
            </TabsContent>
            
            <TabsContent value="backfill" className="space-y-6">
              <AdminBackfill />
            </TabsContent>
            
            <TabsContent value="guards" className="space-y-6">
              <GuardTests />
            </TabsContent>
            
            <TabsContent value="stepup" className="space-y-6">
              <StepUpAuthTest />
            </TabsContent>
            
            <TabsContent value="logs" className="space-y-6">
              <AdminLogsViewer />
              <TelemetryDashboard />
            </TabsContent>
            
            <TabsContent value="more" className="space-y-6">
              <Tabs defaultValue="analytics" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  <TabsTrigger value="billing">Billing</TabsTrigger>
                  <TabsTrigger value="orgs">Orgs</TabsTrigger>
                  <TabsTrigger value="utils">Utils</TabsTrigger>
                </TabsList>
                
                <TabsContent value="analytics" className="space-y-4">
                  <AnalyticsDashboard />
                </TabsContent>
                
                <TabsContent value="billing" className="space-y-4">
                  <BillingAdmin />
                </TabsContent>
                
                <TabsContent value="orgs" className="space-y-4">
                  <OrganizationsDirectory />
                  <MembersAdmin />
                </TabsContent>
                
                <TabsContent value="utils" className="space-y-4">
                  <DataFixes />
                  <EmailIntegrations />
                  <FeatureFlags />
                  <InviteAcceptanceTests />
                  <OrgStatusGuardTest />
                  <RateLimitTest />
                  <SuperadminManagement />
                  <SuspensionSystemTest />
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}