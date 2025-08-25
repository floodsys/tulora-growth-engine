import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Activity, AlertTriangle, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface TelemetryData {
  access_denied_count: number
  profile_forbidden_count: number
  total_denials: number
  last_24h_window: string
}

interface AlertConfig {
  threshold: number
  enabled: boolean
}

export function TelemetryDashboard() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [telemetryData, setTelemetryData] = useState<TelemetryData | null>(null)
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({ threshold: 50, enabled: true })

  const fetchTelemetryData = async () => {
    setLoading(true)
    try {
      // Get the last 24 hours of denial events
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      // Count admin.access_denied events
      const { data: accessDeniedData, error: accessError } = await supabase
        .from('audit_log')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'admin.access_denied')
        .gte('created_at', twentyFourHoursAgo)

      if (accessError) throw accessError

      // Count ORG_PROFILE_FORBIDDEN events specifically
      const { data: profileForbiddenData, error: profileError } = await supabase
        .from('audit_log')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'admin.access_denied')
        .eq('error_code', 'ORG_PROFILE_FORBIDDEN')
        .gte('created_at', twentyFourHoursAgo)

      if (profileError) throw profileError

      const data: TelemetryData = {
        access_denied_count: accessDeniedData?.length || 0,
        profile_forbidden_count: profileForbiddenData?.length || 0,
        total_denials: (accessDeniedData?.length || 0),
        last_24h_window: twentyFourHoursAgo
      }

      setTelemetryData(data)

      // Check if we should trigger an alert
      if (alertConfig.enabled && data.total_denials > alertConfig.threshold) {
        toast({
          title: "Security Alert",
          description: `High number of access denials detected: ${data.total_denials} in last 24h (threshold: ${alertConfig.threshold})`,
          variant: "destructive"
        })

        // Log the alert
        await supabase.rpc('log_event', {
          p_org_id: '00000000-0000-0000-0000-000000000000',
          p_action: 'security.alert_triggered',
          p_target_type: 'telemetry',
          p_actor_user_id: (await supabase.auth.getUser()).data.user?.id,
          p_status: 'warning',
          p_metadata: {
            alert_type: 'access_denied_threshold',
            threshold: alertConfig.threshold,
            actual_count: data.total_denials,
            window: '24h'
          }
        })
      }

    } catch (error: any) {
      console.error('Error fetching telemetry data:', error)
      toast({
        title: "Error",
        description: "Failed to fetch telemetry data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const emitTestCounter = async () => {
    try {
      // Emit a test admin.access_denied event
      await supabase.rpc('log_event', {
        p_org_id: '00000000-0000-0000-0000-000000000000',
        p_action: 'admin.access_denied',
        p_target_type: 'test_resource',
        p_actor_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_status: 'error',
        p_error_code: 'ORG_PROFILE_FORBIDDEN',
        p_metadata: {
          test_counter: true,
          path: '/test/telemetry',
          timestamp: new Date().toISOString()
        }
      })

      toast({
        title: "Test counter emitted",
        description: "Test admin.access_denied event logged",
      })

      // Refresh data
      await fetchTelemetryData()
    } catch (error: any) {
      console.error('Error emitting test counter:', error)
      toast({
        title: "Error",
        description: "Failed to emit test counter",
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    fetchTelemetryData()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Permission Denial Telemetry
        </CardTitle>
        <CardDescription>
          Monitor admin.access_denied and ORG_PROFILE_FORBIDDEN events over the last 24 hours
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={fetchTelemetryData} 
            disabled={loading}
            size="sm"
          >
            {loading ? "Loading..." : "Refresh Data"}
          </Button>
          <Button 
            onClick={emitTestCounter} 
            variant="outline"
            size="sm"
          >
            Emit Test Counter
          </Button>
        </div>

        {telemetryData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Access Denied</p>
                  <p className="text-2xl font-bold">{telemetryData.access_denied_count}</p>
                </div>
                <Shield className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Profile Forbidden</p>
                  <p className="text-2xl font-bold">{telemetryData.profile_forbidden_count}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Alert Status</p>
                  <Badge 
                    variant={telemetryData.total_denials > alertConfig.threshold ? "destructive" : "default"}
                  >
                    {telemetryData.total_denials > alertConfig.threshold ? "ALERT" : "Normal"}
                  </Badge>
                </div>
                <Activity className="h-8 w-8 text-green-500" />
              </div>
            </div>
          </div>
        )}

        <div className="p-3 bg-muted/50 rounded-md">
          <h4 className="font-medium text-sm mb-2">Alert Configuration</h4>
          <div className="flex items-center gap-4 text-sm">
            <span>Threshold: {alertConfig.threshold}/hour</span>
            <Badge variant={alertConfig.enabled ? "default" : "secondary"}>
              {alertConfig.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>

        {telemetryData && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Metrics Window:</strong> Last 24 hours since {new Date(telemetryData.last_24h_window).toLocaleString()}</p>
            <p><strong>Counters tracked:</strong></p>
            <p>• admin.access_denied (all resources, by route/org_id/user_id)</p>
            <p>• ORG_PROFILE_FORBIDDEN responses (organization profile updates)</p>
            <p>• Alert triggers when total denials &gt; {alertConfig.threshold}/hour</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}