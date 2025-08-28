import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Phone, Calendar } from "lucide-react";
import { OrgSwitcherTests } from "./OrgSwitcherTests"
import { ProfileUpdateTests } from "./ProfileUpdateTests"
import { DemoArtifactLinter } from "./DemoArtifactLinter"
import { OrganizationProfileTests } from "./OrganizationProfileTests"
import { TeamsConsolidationTests } from "./TeamsConsolidationTests"
import { HiddenTestsRunner } from "./HiddenTestsRunner"

export function TestDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          System management, monitoring, and testing tools
        </p>
      </div>

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
            <TeamsConsolidationTests />
            <HiddenTestsRunner />
            <OrgSwitcherTests />
            <ProfileUpdateTests />
            <DemoArtifactLinter />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}