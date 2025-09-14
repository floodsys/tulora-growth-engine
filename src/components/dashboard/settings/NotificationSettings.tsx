import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

export function NotificationSettings() {
  const { toast } = useToast()
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [systemAlerts, setSystemAlerts] = useState(true)
  const [callNotifications, setCallNotifications] = useState(true)
  const [appointmentReminders, setAppointmentReminders] = useState(true)

  const handleSave = () => {
    // TODO: Implement notification settings save
    toast({
      title: "Settings updated",
      description: "Notification settings have been saved successfully.",
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notification Settings</h1>
        <p className="text-muted-foreground">Manage how you receive notifications</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>Configure which emails you want to receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive email notifications for important updates
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="call-notifications">Call Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when calls are completed or missed
              </p>
            </div>
            <Switch
              id="call-notifications"
              checked={callNotifications}
              onCheckedChange={setCallNotifications}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="appointment-reminders">Appointment Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Receive reminders for upcoming appointments
              </p>
            </div>
            <Switch
              id="appointment-reminders"
              checked={appointmentReminders}
              onCheckedChange={setAppointmentReminders}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Alerts</CardTitle>
          <CardDescription>Configure system-level notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="system-alerts">System Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Receive alerts about system status and maintenance
              </p>
            </div>
            <Switch
              id="system-alerts"
              checked={systemAlerts}
              onCheckedChange={setSystemAlerts}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave}>
        Save Notification Settings
      </Button>
    </div>
  )
}