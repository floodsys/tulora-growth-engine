import { ActivityFeed } from "@/components/ActivityFeed";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Shield, AlertTriangle, Info, Settings, Eye } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { useUserOrganization } from "@/hooks/useUserOrganization";

export default function ActivityLogs() {
  const { organizationId } = useUserOrganization();
  const { isAdmin } = useOrganizationRole(organizationId || undefined);

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 flex items-center border-b bg-background px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Activity & Audit Logs</h1>
          {isAdmin && (
            <Badge variant="secondary" className="ml-2">
              <Settings className="h-3 w-3 mr-1" />
              Admin Access
            </Badge>
          )}
        </div>
      </header>
      
      <div className="p-4 md:p-6 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600" />
                Audit Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Live</div>
              <p className="text-xs text-muted-foreground">
                Customer-visible security logs
              </p>
            </CardContent>
          </Card>

          {isAdmin && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4 text-blue-600" />
                  Internal Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Admin</div>
                <p className="text-xs text-muted-foreground">
                  System & diagnostic events
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="h-4 w-4 text-purple-600" />
                Privacy Protection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">PII</div>
              <p className="text-xs text-muted-foreground">
                Hashed IPs, minimal data
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                Retention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">90d</div>
              <p className="text-xs text-muted-foreground">
                Log retention period
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Information Alerts */}
        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Audit Channel:</strong> Customer-visible security events, settings changes, and operational activities. 
              This data is available to all organization members and forms your compliance audit trail.
            </AlertDescription>
          </Alert>

          {isAdmin && (
            <Alert className="border-blue-200 bg-blue-50">
              <Settings className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Internal Channel:</strong> System diagnostics, performance events, and technical logging. 
                Only visible to organization administrators. Never shown to regular users.
              </AlertDescription>
            </Alert>
          )}

          <Alert className="border-purple-200 bg-purple-50">
            <Eye className="h-4 w-4 text-purple-600" />
            <AlertDescription className="text-purple-800">
              <strong>Privacy Design:</strong> IP addresses are hashed (8-char SHA256), user agents are trimmed, 
              and sensitive tokens are automatically scrubbed. All events include tracing IDs for support.
            </AlertDescription>
          </Alert>
        </div>

        {/* Main Activity Feed with Channel Selection */}
        <ActivityFeed 
          showFilters={true} 
          maxHeight="h-[600px]" 
          compact={false}
          channelFilter="all"
        />
      </div>
    </div>
  );
}