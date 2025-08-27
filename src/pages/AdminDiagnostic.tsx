import React from 'react';
import { AdminSessionPanel } from '@/components/admin/AdminSessionPanel';
import { AdminTestRunner } from '@/components/admin/AdminTestRunner';
import SuperadminTestHarness from '@/components/admin/SuperadminTestHarness';
import { AdminBackfill } from '@/components/admin/AdminBackfill';
import GuardTests from '@/components/admin/GuardTests';
import { StepUpAuthTest } from '@/components/admin/StepUpAuthTest';
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
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="session">Session</TabsTrigger>
              <TabsTrigger value="tests">Tests</TabsTrigger>
              <TabsTrigger value="superadmin">Superadmin</TabsTrigger>
              <TabsTrigger value="backfill">Backfill</TabsTrigger>
              <TabsTrigger value="guards">Guards</TabsTrigger>
              <TabsTrigger value="stepup">Step-Up</TabsTrigger>
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
          </Tabs>
        </div>
      </div>
    </div>
  );
}