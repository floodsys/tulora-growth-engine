import { ActivityFeed } from "@/components/ActivityFeed";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Shield, AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ActivityLogs() {
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 flex items-center border-b bg-background px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Activity & Audit Logs</h1>
        </div>
      </header>
      
      <div className="p-4 md:p-6 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600" />
                Security Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                No security alerts detected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" />
                Recent Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24h</div>
              <p className="text-xs text-muted-foreground">
                Latest activity tracking
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                Data Retention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">90d</div>
              <p className="text-xs text-muted-foreground">
                Activity log retention period
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Information Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Activity logs capture all significant actions within your organization for audit and security purposes. 
            This includes user logins, data modifications, permission changes, and system events.
          </AlertDescription>
        </Alert>

        {/* Main Activity Feed */}
        <ActivityFeed showFilters={true} maxHeight="h-[600px]" compact={false} />
      </div>
    </div>
  );
}